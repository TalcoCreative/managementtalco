import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Clock, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CheckSquare,
  Video,
  CalendarClock,
  PartyPopper,
  Filter,
  Eye
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, differenceInMinutes, eachDayOfInterval } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { HRWorkHoursChart } from "@/components/hr-analytics/HRWorkHoursChart";
import { HRActivityDistributionChart } from "@/components/hr-analytics/HRActivityDistributionChart";
import { HRAutoClockoutChart } from "@/components/hr-analytics/HRAutoClockoutChart";
import { HRMonthComparisonChart } from "@/components/hr-analytics/HRMonthComparisonChart";
import { HRRiskPanel } from "@/components/hr-analytics/HRRiskPanel";
import { HRProductivityRanking } from "@/components/hr-analytics/HRProductivityRanking";
import { usePositions, getRoleLabel } from "@/hooks/usePositions";

export default function HRAnalytics() {
  const navigate = useNavigate();
  const { data: positions } = usePositions();
  const now = new Date();
  
  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [compareMonth, setCompareMonth] = useState(format(subMonths(now, 1), 'yyyy-MM'));
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");

  // Fetch profiles
  const { data: profiles } = useQuery({
    queryKey: ["hr-analytics-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user roles
  const { data: userRoles } = useQuery({
    queryKey: ["hr-analytics-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch attendance for current period
  const { data: attendance } = useQuery({
    queryKey: ["hr-analytics-attendance", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch attendance for comparison period
  const { data: compareAttendance } = useQuery({
    queryKey: ["hr-analytics-compare-attendance", compareMonth],
    queryFn: async () => {
      const compareStart = format(startOfMonth(new Date(compareMonth + '-01')), 'yyyy-MM-dd');
      const compareEnd = format(endOfMonth(new Date(compareMonth + '-01')), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", compareStart)
        .lte("date", compareEnd);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch tasks
  const { data: tasks } = useQuery({
    queryKey: ["hr-analytics-tasks", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, task_assignees(user_id)")
        .or(`created_at.gte.${startDate}T00:00:00,deadline.gte.${startDate}`)
        .or(`created_at.lte.${endDate}T23:59:59,deadline.lte.${endDate}`);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch meetings
  const { data: meetings } = useQuery({
    queryKey: ["hr-analytics-meetings", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, meeting_participants(user_id)")
        .gte("meeting_date", startDate)
        .lte("meeting_date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch shootings
  const { data: shootings } = useQuery({
    queryKey: ["hr-analytics-shootings", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select("*, shooting_crew(user_id)")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch events
  const { data: events } = useQuery({
    queryKey: ["hr-analytics-events", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_crew(user_id)")
        .gte("start_date", startDate)
        .lte("end_date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["hr-analytics-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate work hours
  const calculateWorkMinutes = (clockIn: string | null, clockOut: string | null, breakMinutes: number = 0) => {
    if (!clockIn || !clockOut) return 0;
    const minutes = differenceInMinutes(parseISO(clockOut), parseISO(clockIn));
    return Math.max(0, minutes - breakMinutes);
  };

  // Filter profiles by role
  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    if (roleFilter === "all") return profiles;
    return profiles.filter(p => {
      const roles = userRoles?.filter(r => r.user_id === p.id).map(r => r.role) || [];
      return roles.includes(roleFilter as any);
    });
  }, [profiles, userRoles, roleFilter]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalEmployees = filteredProfiles.length;
    
    // Work hours
    const totalWorkMinutes = attendance?.reduce((sum, a) => {
      return sum + calculateWorkMinutes(a.clock_in, a.clock_out, a.total_break_minutes || 0);
    }, 0) || 0;
    const totalWorkHours = Math.round(totalWorkMinutes / 60 * 10) / 10;
    const avgWorkHoursPerEmployee = totalEmployees > 0 ? Math.round(totalWorkHours / totalEmployees * 10) / 10 : 0;

    // Activities count
    const taskCount = tasks?.length || 0;
    const meetingCount = meetings?.length || 0;
    const shootingCount = shootings?.length || 0;
    const eventCount = events?.length || 0;
    const totalActivities = taskCount + meetingCount + shootingCount + eventCount;

    // Overdue tasks
    const overdueTaskCount = tasks?.filter(t => {
      if (!t.deadline) return false;
      if (t.status === 'done' || t.status === 'completed') return false;
      return new Date(t.deadline) < new Date();
    }).length || 0;

    // Auto clock-out count
    const autoClockoutCount = attendance?.filter(a => 
      a.notes?.includes('[AUTO CLOCK-OUT')
    ).length || 0;

    // Average productivity (activities per employee)
    const avgProductivity = totalEmployees > 0 ? Math.round(totalActivities / totalEmployees * 10) / 10 : 0;

    // Compare period calculations
    const compareTotalMinutes = compareAttendance?.reduce((sum, a) => {
      return sum + calculateWorkMinutes(a.clock_in, a.clock_out, a.total_break_minutes || 0);
    }, 0) || 0;
    const compareTotalHours = Math.round(compareTotalMinutes / 60 * 10) / 10;
    const compareAutoClockout = compareAttendance?.filter(a => 
      a.notes?.includes('[AUTO CLOCK-OUT')
    ).length || 0;

    // Calculate changes
    const workHoursChange = compareTotalHours > 0 
      ? Math.round((totalWorkHours - compareTotalHours) / compareTotalHours * 100) 
      : 0;
    const autoClockoutChange = compareAutoClockout > 0 
      ? Math.round((autoClockoutCount - compareAutoClockout) / compareAutoClockout * 100)
      : autoClockoutCount > 0 ? 100 : 0;

    return {
      totalEmployees,
      totalWorkHours,
      avgWorkHoursPerEmployee,
      totalActivities,
      taskCount,
      meetingCount,
      shootingCount,
      eventCount,
      overdueTaskCount,
      autoClockoutCount,
      avgProductivity,
      workHoursChange,
      autoClockoutChange,
    };
  }, [filteredProfiles, attendance, tasks, meetings, shootings, events, compareAttendance]);

  // Get unique roles for filter
  const uniqueRoles = useMemo(() => {
    const roles = new Set(userRoles?.map(r => r.role) || []);
    return Array.from(roles);
  }, [userRoles]);

  const handleViewEmployee = (employeeId: string) => {
    navigate(`/hr/employee/${employeeId}/insight`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">HR Analytics Overview</h1>
          <p className="text-muted-foreground">Gambaran besar performa SDM berdasarkan jam kerja, aktivitas, dan konsistensi</p>
        </div>

        {/* Global Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Akhir</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Bandingkan dengan</Label>
                <Input
                  type="month"
                  value={compareMonth}
                  onChange={(e) => setCompareMonth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Role</SelectItem>
                    {uniqueRoles.map(role => (
                      <SelectItem key={role} value={role}>{getRoleLabel(positions, role)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Project</SelectItem>
                    {projects?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jenis Aktivitas</Label>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Aktivitas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Aktivitas</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="shooting">Shooting</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
                }}
              >
                Bulan Ini
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const lastMonth = subMonths(now, 1);
                  setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
                }}
              >
                Bulan Lalu
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Karyawan</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Aktif periode ini</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Jam Kerja</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalWorkHours}h</div>
              <div className="flex items-center text-xs">
                {kpis.workHoursChange >= 0 ? (
                  <><ArrowUpRight className="h-3 w-3 text-green-500" /><span className="text-green-500">+{kpis.workHoursChange}%</span></>
                ) : (
                  <><ArrowDownRight className="h-3 w-3 text-red-500" /><span className="text-red-500">{kpis.workHoursChange}%</span></>
                )}
                <span className="text-muted-foreground ml-1">vs bulan lalu</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rata-rata Jam</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.avgWorkHoursPerEmployee}h</div>
              <p className="text-xs text-muted-foreground">Per karyawan</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Aktivitas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalActivities}</div>
              <div className="flex gap-1 flex-wrap text-xs text-muted-foreground">
                <span>{kpis.taskCount} task</span>•
                <span>{kpis.meetingCount} meet</span>•
                <span>{kpis.shootingCount} shoot</span>•
                <span>{kpis.eventCount} event</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Task Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{kpis.overdueTaskCount}</div>
              <p className="text-xs text-muted-foreground">Belum selesai</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Auto Clock-out</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{kpis.autoClockoutCount}</div>
              <div className="flex items-center text-xs">
                {kpis.autoClockoutChange <= 0 ? (
                  <><ArrowDownRight className="h-3 w-3 text-green-500" /><span className="text-green-500">{kpis.autoClockoutChange}%</span></>
                ) : (
                  <><ArrowUpRight className="h-3 w-3 text-red-500" /><span className="text-red-500">+{kpis.autoClockoutChange}%</span></>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Produktivitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.avgProductivity}</div>
              <p className="text-xs text-muted-foreground">Aktivitas/orang</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <HRWorkHoursChart 
            attendance={attendance || []} 
            tasks={tasks || []}
            meetings={meetings || []}
            shootings={shootings || []}
            events={events || []}
            startDate={startDate}
            endDate={endDate}
          />
          <HRActivityDistributionChart 
            taskCount={kpis.taskCount}
            meetingCount={kpis.meetingCount}
            shootingCount={kpis.shootingCount}
            eventCount={kpis.eventCount}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <HRAutoClockoutChart 
            attendance={attendance || []}
            startDate={startDate}
            endDate={endDate}
          />
          <HRMonthComparisonChart 
            currentAttendance={attendance || []}
            compareAttendance={compareAttendance || []}
            currentTasks={tasks || []}
            currentMonth={format(new Date(startDate), 'MMM yyyy', { locale: idLocale })}
            compareMonth={format(new Date(compareMonth + '-01'), 'MMM yyyy', { locale: idLocale })}
          />
        </div>

        {/* Risk & Bottleneck Panel */}
        <HRRiskPanel 
          profiles={filteredProfiles}
          attendance={attendance || []}
          tasks={tasks || []}
          onViewEmployee={handleViewEmployee}
        />

        {/* Productivity Ranking */}
        <HRProductivityRanking 
          profiles={filteredProfiles}
          attendance={attendance || []}
          tasks={tasks || []}
          meetings={meetings || []}
          shootings={shootings || []}
          events={events || []}
          onViewEmployee={handleViewEmployee}
        />
      </div>
    </AppLayout>
  );
}
