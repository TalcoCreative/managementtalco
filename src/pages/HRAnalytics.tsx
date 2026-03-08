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
import { TaskDurationAnalytics } from "@/components/hr-analytics/TaskDurationAnalytics";
import { usePositions, getRoleLabel } from "@/hooks/usePositions";

export default function HRAnalytics() {
  const navigate = useNavigate();
  const { data: positions } = usePositions();
  const now = new Date();
  
  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [compareMonth, setCompareMonth] = useState("");
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

  // Fetch attendance for comparison period (only when compareMonth is set)
  const { data: compareAttendance } = useQuery({
    queryKey: ["hr-analytics-compare-attendance", compareMonth],
    queryFn: async () => {
      if (!compareMonth) return [];
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
    enabled: !!compareMonth,
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

  // Fetch published EP slides
  const { data: publishedSlides } = useQuery({
    queryKey: ["hr-analytics-published-slides", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editorial_slides")
        .select("id, created_by, published_at")
        .eq("status", "published")
        .not("published_at", "is", null)
        .gte("published_at", `${startDate}T00:00:00`)
        .lte("published_at", `${endDate}T23:59:59`);
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

  // Fetch task status logs for duration tracking
  const { data: taskStatusLogs } = useQuery({
    queryKey: ["hr-analytics-status-logs", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_status_logs")
        .select("*")
        .gte("changed_at", `${startDate}T00:00:00`)
        .lte("changed_at", `${endDate}T23:59:59`)
        .order("changed_at", { ascending: true });
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

  // Get filtered user IDs based on role filter
  const filteredUserIds = useMemo(() => {
    return new Set(filteredProfiles.map(p => p.id));
  }, [filteredProfiles]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalEmployees = filteredProfiles.length;
    
    // Filter attendance by filtered users
    const filteredAttendance = attendance?.filter(a => filteredUserIds.has(a.user_id)) || [];
    const filteredCompareAttendance = compareAttendance?.filter(a => filteredUserIds.has(a.user_id)) || [];
    
    // Work hours (filtered)
    const totalWorkMinutes = filteredAttendance.reduce((sum, a) => {
      return sum + calculateWorkMinutes(a.clock_in, a.clock_out, a.total_break_minutes || 0);
    }, 0);
    const totalWorkHours = Math.round(totalWorkMinutes / 60 * 10) / 10;
    const avgWorkHoursPerEmployee = totalEmployees > 0 ? Math.round(totalWorkHours / totalEmployees * 10) / 10 : 0;

    // Filter tasks by assignees
    const filteredTasks = tasks?.filter(t => {
      const assigneeIds = t.task_assignees?.map((a: any) => a.user_id) || [];
      return assigneeIds.some((id: string) => filteredUserIds.has(id)) || filteredUserIds.has(t.created_by);
    }) || [];

    // Filter meetings by participants
    const filteredMeetings = meetings?.filter(m => {
      const participantIds = m.meeting_participants?.map((p: any) => p.user_id) || [];
      return participantIds.some((id: string) => filteredUserIds.has(id)) || filteredUserIds.has(m.created_by);
    }) || [];

    // Filter shootings by crew
    const filteredShootings = shootings?.filter(s => {
      const crewIds = s.shooting_crew?.map((c: any) => c.user_id) || [];
      return crewIds.some((id: string) => filteredUserIds.has(id)) || filteredUserIds.has(s.requested_by);
    }) || [];

    // Filter events by crew
    const filteredEvents = events?.filter(e => {
      const crewIds = e.event_crew?.map((c: any) => c.user_id) || [];
      return crewIds.some((id: string) => filteredUserIds.has(id)) || filteredUserIds.has(e.created_by);
    }) || [];

    // Activities count (filtered)
    const taskCount = filteredTasks.length;
    const meetingCount = filteredMeetings.length;
    const shootingCount = filteredShootings.length;
    const eventCount = filteredEvents.length;
    const totalActivities = taskCount + meetingCount + shootingCount + eventCount;

    // Overdue tasks (filtered)
    const overdueTaskCount = filteredTasks.filter(t => {
      if (!t.deadline) return false;
      if (t.status === 'done' || t.status === 'completed') return false;
      return new Date(t.deadline) < new Date();
    }).length;

    // Auto clock-out count (filtered)
    const autoClockoutCount = filteredAttendance.filter(a => 
      a.notes?.includes('[AUTO CLOCK-OUT')
    ).length;

    // Average productivity (activities per employee)
    const avgProductivity = totalEmployees > 0 ? Math.round(totalActivities / totalEmployees * 10) / 10 : 0;

    // Compare period calculations (filtered)
    const compareTotalMinutes = filteredCompareAttendance.reduce((sum, a) => {
      return sum + calculateWorkMinutes(a.clock_in, a.clock_out, a.total_break_minutes || 0);
    }, 0);
    const compareTotalHours = Math.round(compareTotalMinutes / 60 * 10) / 10;
    const compareAutoClockout = filteredCompareAttendance.filter(a => 
      a.notes?.includes('[AUTO CLOCK-OUT')
    ).length;

    // Calculate changes (only when comparison is active)
    const hasComparison = !!compareMonth && filteredCompareAttendance.length > 0;
    const workHoursChange = hasComparison && compareTotalHours > 0 
      ? Math.round((totalWorkHours - compareTotalHours) / compareTotalHours * 100) 
      : null;
    const autoClockoutChange = hasComparison
      ? (compareAutoClockout > 0 
        ? Math.round((autoClockoutCount - compareAutoClockout) / compareAutoClockout * 100)
        : autoClockoutCount > 0 ? 100 : 0)
      : null;

    // Late stats
    const lateCount = filteredAttendance.filter(a => a.late_status === 'Late').length;
    const compareLateCount = filteredCompareAttendance.filter(a => a.late_status === 'Late').length;
    const lateChange = hasComparison && compareLateCount > 0
      ? Math.round((lateCount - compareLateCount) / compareLateCount * 100)
      : hasComparison ? (lateCount > 0 ? 100 : 0) : null;

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
      lateCount,
      lateChange,
    };
  }, [filteredProfiles, filteredUserIds, attendance, tasks, meetings, shootings, events, compareAttendance, compareMonth]);

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
        {/* Header — Immersive section */}
        <div className="section-header" style={{ '--section-color': 'var(--section-hr)' } as React.CSSProperties}>
          <div className="section-icon">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="section-title">HR Analytics Overview</h1>
            <p className="section-subtitle">Gambaran besar performa SDM berdasarkan jam kerja, aktivitas, dan konsistensi</p>
          </div>
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

        {/* Quick Employee Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lihat Per Karyawan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filteredProfiles.map(profile => {
                const roles = userRoles?.filter(r => r.user_id === profile.id).map(r => r.role) || [];
                const roleLabel = roles.length > 0 ? getRoleLabel(positions, roles[0]) : "No Role";
                return (
                  <Button
                    key={profile.id}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleViewEmployee(profile.id)}
                  >
                    <Eye className="h-3 w-3" />
                    <span>{profile.full_name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {roleLabel}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Cards — Colorful */}
        <div className="section-divider">
          <span className="divider-label">Key Metrics</span>
        </div>
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
          <div className="kpi-card p-4" style={{ '--kpi-color': 'var(--section-hr)' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total Karyawan</span>
              <div className="kpi-icon w-8 h-8"><Users className="h-4 w-4" /></div>
            </div>
            <div className="kpi-value">{kpis.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Aktif periode ini</p>
          </div>

          <div className="kpi-card p-4" style={{ '--kpi-color': 'var(--section-projects)' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total Jam Kerja</span>
              <div className="kpi-icon w-8 h-8"><Clock className="h-4 w-4" /></div>
            </div>
            <div className="kpi-value">{kpis.totalWorkHours}h</div>
            {kpis.workHoursChange !== null ? (
              <div className="flex items-center text-xs">
                {kpis.workHoursChange >= 0 ? (
                  <><ArrowUpRight className="h-3 w-3 kpi-trend-up" /><span className="kpi-trend-up">+{kpis.workHoursChange}%</span></>
                ) : (
                  <><ArrowDownRight className="h-3 w-3 kpi-trend-down" /><span className="kpi-trend-down">{kpis.workHoursChange}%</span></>
                )}
                <span className="text-muted-foreground ml-1">vs {compareMonth}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Pilih bulan bandingkan</p>
            )}
          </div>

          <div className="kpi-card p-4" style={{ '--kpi-color': 'var(--section-meeting)' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Rata-rata Jam</span>
              <div className="kpi-icon w-8 h-8"><Clock className="h-4 w-4" /></div>
            </div>
            <div className="kpi-value">{kpis.avgWorkHoursPerEmployee}h</div>
            <p className="text-xs text-muted-foreground">Per karyawan</p>
          </div>

          <div className="kpi-card p-4" style={{ '--kpi-color': 'var(--section-schedule)' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Total Aktivitas</span>
              <div className="kpi-icon w-8 h-8"><Activity className="h-4 w-4" /></div>
            </div>
            <div className="kpi-value">{kpis.totalActivities}</div>
            <div className="flex gap-1 flex-wrap text-xs text-muted-foreground">
              <span>{kpis.taskCount} task</span>•
              <span>{kpis.meetingCount} meet</span>•
              <span>{kpis.shootingCount} shoot</span>•
              <span>{kpis.eventCount} event</span>
            </div>
          </div>

          <div className="kpi-card p-4" style={{ '--kpi-color': '0 62% 54%' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Task Overdue</span>
              <div className="kpi-icon w-8 h-8"><AlertTriangle className="h-4 w-4" /></div>
            </div>
            <div className="kpi-value" style={{ color: 'hsl(0 62% 54%)' }}>{kpis.overdueTaskCount}</div>
            <p className="text-xs text-muted-foreground">Belum selesai</p>
          </div>

          <div className="kpi-card p-4" style={{ '--kpi-color': 'var(--section-schedule)' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Auto Clock-out</span>
              <div className="kpi-icon w-8 h-8"><AlertTriangle className="h-4 w-4" /></div>
            </div>
            <div className="kpi-value" style={{ color: 'hsl(var(--warning))' }}>{kpis.autoClockoutCount}</div>
            {kpis.autoClockoutChange !== null ? (
              <div className="flex items-center text-xs">
                {kpis.autoClockoutChange <= 0 ? (
                  <><ArrowDownRight className="h-3 w-3 kpi-trend-up" /><span className="kpi-trend-up">{kpis.autoClockoutChange}%</span></>
                ) : (
                  <><ArrowUpRight className="h-3 w-3 kpi-trend-down" /><span className="kpi-trend-down">+{kpis.autoClockoutChange}%</span></>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Periode ini</p>
            )}
          </div>

          <div className="kpi-card p-4" style={{ '--kpi-color': '0 62% 54%' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Terlambat</span>
              <div className="kpi-icon w-8 h-8"><Clock className="h-4 w-4" /></div>
            </div>
            <div className="kpi-value" style={{ color: 'hsl(0 62% 54%)' }}>{kpis.lateCount}x</div>
            {kpis.lateChange !== null ? (
              <div className="flex items-center text-xs">
                {kpis.lateChange <= 0 ? (
                  <><ArrowDownRight className="h-3 w-3 kpi-trend-up" /><span className="kpi-trend-up">{kpis.lateChange}%</span></>
                ) : (
                  <><ArrowUpRight className="h-3 w-3 kpi-trend-down" /><span className="kpi-trend-down">+{kpis.lateChange}%</span></>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Total keterlambatan</p>
            )}
          </div>

          <div className="kpi-card p-4" style={{ '--kpi-color': 'var(--section-finance)' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Produktivitas</span>
              <div className="kpi-icon w-8 h-8"><TrendingUp className="h-4 w-4" /></div>
            </div>
            <div className="kpi-value">{kpis.avgProductivity}</div>
            <p className="text-xs text-muted-foreground">Aktivitas/orang</p>
          </div>
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
          {compareMonth && (
            <HRMonthComparisonChart 
              currentAttendance={attendance || []}
              compareAttendance={compareAttendance || []}
              currentTasks={tasks || []}
              currentMonth={format(new Date(startDate), 'MMM yyyy', { locale: idLocale })}
              compareMonth={format(new Date(compareMonth + '-01'), 'MMM yyyy', { locale: idLocale })}
            />
          )}
        </div>

        {/* Risk & Bottleneck Panel */}
        <HRRiskPanel 
          profiles={filteredProfiles}
          attendance={attendance || []}
          tasks={tasks || []}
          onViewEmployee={handleViewEmployee}
        />

        {/* Task Duration Analytics */}
        <TaskDurationAnalytics
          statusLogs={taskStatusLogs || []}
          tasks={tasks || []}
          profiles={profiles || []}
          title="Task Duration Analytics"
          showPerEmployee={true}
        />

        {/* Productivity Ranking */}
        <HRProductivityRanking 
          profiles={filteredProfiles}
          attendance={attendance || []}
          tasks={tasks || []}
          meetings={meetings || []}
          shootings={shootings || []}
          events={events || []}
          publishedSlides={publishedSlides || []}
          onViewEmployee={handleViewEmployee}
        />
      </div>
    </AppLayout>
  );
}
