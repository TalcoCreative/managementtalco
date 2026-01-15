import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft,
  User,
  Clock,
  Calendar,
  Activity,
  CheckSquare,
  Video,
  CalendarClock,
  PartyPopper,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Coffee,
  Briefcase,
  Filter
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, differenceInMinutes, differenceInHours, eachDayOfInterval } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { EmployeeAttendanceChart } from "@/components/hr-analytics/EmployeeAttendanceChart";
import { EmployeeActivityChart } from "@/components/hr-analytics/EmployeeActivityChart";
import { EmployeeMonthComparison } from "@/components/hr-analytics/EmployeeMonthComparison";
import { EmployeeProjectContribution } from "@/components/hr-analytics/EmployeeProjectContribution";
import { EmployeeInsightPanel } from "@/components/hr-analytics/EmployeeInsightPanel";
import { EmployeeDailyLog } from "@/components/hr-analytics/EmployeeDailyLog";

export default function EmployeeInsight() {
  const { id: employeeId } = useParams();
  const navigate = useNavigate();
  const now = new Date();

  // Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [compareMonth, setCompareMonth] = useState(format(subMonths(now, 1), 'yyyy-MM'));

  // Fetch employee profile
  const { data: profile } = useQuery({
    queryKey: ["employee-profile", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  // Fetch user roles
  const { data: employeeRoles } = useQuery({
    queryKey: ["employee-roles", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", employeeId);
      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
    enabled: !!employeeId,
  });

  // Fetch attendance for current period
  const { data: attendance } = useQuery({
    queryKey: ["employee-attendance", employeeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", employeeId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });

  // Fetch attendance for comparison period
  const { data: compareAttendance } = useQuery({
    queryKey: ["employee-compare-attendance", employeeId, compareMonth],
    queryFn: async () => {
      const compareStart = format(startOfMonth(new Date(compareMonth + '-01')), 'yyyy-MM-dd');
      const compareEnd = format(endOfMonth(new Date(compareMonth + '-01')), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", employeeId)
        .gte("date", compareStart)
        .lte("date", compareEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });

  // Fetch tasks (created by or assigned to)
  const { data: tasks } = useQuery({
    queryKey: ["employee-tasks", employeeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(id, title), task_assignees(user_id)")
        .or(`created_by.eq.${employeeId},assigned_to.eq.${employeeId}`)
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });

  // Fetch meetings
  const { data: meetings } = useQuery({
    queryKey: ["employee-meetings", employeeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, projects(id, title), meeting_participants!inner(user_id)")
        .gte("meeting_date", startDate)
        .lte("meeting_date", endDate);
      if (error) throw error;
      // Filter meetings where user is creator or participant
      return (data || []).filter(m => 
        m.created_by === employeeId || 
        m.meeting_participants?.some((p: any) => p.user_id === employeeId)
      );
    },
    enabled: !!employeeId,
  });

  // Fetch shootings
  const { data: shootings } = useQuery({
    queryKey: ["employee-shootings", employeeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select("*, projects(id, title), shooting_crew(user_id)")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);
      if (error) throw error;
      // Filter shootings where user is involved
      return (data || []).filter(s => 
        s.requested_by === employeeId ||
        s.director === employeeId ||
        s.runner === employeeId ||
        s.shooting_crew?.some((c: any) => c.user_id === employeeId)
      );
    },
    enabled: !!employeeId,
  });

  // Fetch events
  const { data: events } = useQuery({
    queryKey: ["employee-events", employeeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, projects(id, title), event_crew(user_id)")
        .gte("start_date", startDate)
        .lte("end_date", endDate);
      if (error) throw error;
      // Filter events where user is involved
      return (data || []).filter(e => 
        e.created_by === employeeId ||
        e.pic_id === employeeId ||
        e.event_crew?.some((c: any) => c.user_id === employeeId)
      );
    },
    enabled: !!employeeId,
  });

  // Calculate work minutes helper
  const calculateWorkMinutes = (clockIn: string | null, clockOut: string | null, breakMinutes: number = 0) => {
    if (!clockIn || !clockOut) return 0;
    const minutes = differenceInMinutes(parseISO(clockOut), parseISO(clockIn));
    return Math.max(0, minutes - breakMinutes);
  };

  // Calculate attendance KPIs
  const attendanceKpis = useMemo(() => {
    const totalMinutes = attendance?.reduce((sum, a) => {
      return sum + calculateWorkMinutes(a.clock_in, a.clock_out, a.total_break_minutes || 0);
    }, 0) || 0;
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
    
    const daysPresent = attendance?.filter(a => a.clock_in).length || 0;
    const autoClockoutDays = attendance?.filter(a => a.notes?.includes('[AUTO CLOCK-OUT')).length || 0;
    
    // Calculate average clock in/out times
    const clockInTimes = attendance?.filter(a => a.clock_in).map(a => {
      const time = parseISO(a.clock_in!);
      return time.getHours() * 60 + time.getMinutes();
    }) || [];
    const avgClockInMinutes = clockInTimes.length > 0 
      ? Math.round(clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length)
      : 0;
    const avgClockIn = clockInTimes.length > 0 
      ? `${Math.floor(avgClockInMinutes / 60).toString().padStart(2, '0')}:${(avgClockInMinutes % 60).toString().padStart(2, '0')}`
      : '-';

    const clockOutTimes = attendance?.filter(a => a.clock_out && !a.notes?.includes('[AUTO CLOCK-OUT')).map(a => {
      const time = parseISO(a.clock_out!);
      return time.getHours() * 60 + time.getMinutes();
    }) || [];
    const avgClockOutMinutes = clockOutTimes.length > 0 
      ? Math.round(clockOutTimes.reduce((a, b) => a + b, 0) / clockOutTimes.length)
      : 0;
    const avgClockOut = clockOutTimes.length > 0 
      ? `${Math.floor(avgClockOutMinutes / 60).toString().padStart(2, '0')}:${(avgClockOutMinutes % 60).toString().padStart(2, '0')}`
      : '-';

    const totalBreakMinutes = attendance?.reduce((sum, a) => sum + (a.total_break_minutes || 0), 0) || 0;

    // Compare with last month
    const compareMinutes = compareAttendance?.reduce((sum, a) => {
      return sum + calculateWorkMinutes(a.clock_in, a.clock_out, a.total_break_minutes || 0);
    }, 0) || 0;
    const compareHours = Math.round(compareMinutes / 60 * 10) / 10;
    const hoursChange = compareHours > 0 
      ? Math.round((totalHours - compareHours) / compareHours * 100)
      : 0;

    const compareDaysPresent = compareAttendance?.filter(a => a.clock_in).length || 0;
    const daysChange = compareDaysPresent > 0
      ? Math.round((daysPresent - compareDaysPresent) / compareDaysPresent * 100)
      : 0;

    return {
      totalHours,
      daysPresent,
      autoClockoutDays,
      avgClockIn,
      avgClockOut,
      totalBreakMinutes,
      hoursChange,
      daysChange,
    };
  }, [attendance, compareAttendance]);

  // Calculate activity KPIs
  const activityKpis = useMemo(() => {
    const tasksCreated = tasks?.filter(t => t.created_by === employeeId).length || 0;
    const tasksCompleted = tasks?.filter(t => 
      (t.assigned_to === employeeId || t.task_assignees?.some((a: any) => a.user_id === employeeId)) &&
      (t.status === 'done' || t.status === 'completed')
    ).length || 0;
    const tasksOverdue = tasks?.filter(t => {
      if (!t.deadline) return false;
      if (t.status === 'done' || t.status === 'completed') return false;
      const isAssigned = t.assigned_to === employeeId || t.task_assignees?.some((a: any) => a.user_id === employeeId);
      return isAssigned && new Date(t.deadline) < new Date();
    }).length || 0;

    const meetingCount = meetings?.length || 0;
    const shootingCount = shootings?.length || 0;
    const eventCount = events?.length || 0;

    return {
      tasksCreated,
      tasksCompleted,
      tasksOverdue,
      meetingCount,
      shootingCount,
      eventCount,
      totalActivities: tasksCompleted + meetingCount + shootingCount + eventCount,
    };
  }, [tasks, meetings, shootings, events, employeeId]);

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/hr/analytics')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4 flex-1">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-lg">
                {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{profile.full_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {employeeRoles?.map(role => (
                  <Badge key={role} variant="secondary">{role}</Badge>
                ))}
                {profile.created_at && (
                  <span className="text-sm text-muted-foreground">
                    Bergabung {format(parseISO(profile.created_at), 'MMM yyyy', { locale: idLocale })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Period Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Periode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
                    setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
                  }}
                >
                  Bulan Ini
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="attendance">Kehadiran</TabsTrigger>
            <TabsTrigger value="activity">Aktivitas</TabsTrigger>
            <TabsTrigger value="projects">Kontribusi Project</TabsTrigger>
            <TabsTrigger value="insight">Insight</TabsTrigger>
            <TabsTrigger value="daily">Log Harian</TabsTrigger>
          </TabsList>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6">
            {/* Attendance KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Jam Kerja</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{attendanceKpis.totalHours}h</div>
                  <div className="flex items-center text-xs">
                    {attendanceKpis.hoursChange >= 0 ? (
                      <><ArrowUpRight className="h-3 w-3 text-green-500" /><span className="text-green-500">+{attendanceKpis.hoursChange}%</span></>
                    ) : (
                      <><ArrowDownRight className="h-3 w-3 text-red-500" /><span className="text-red-500">{attendanceKpis.hoursChange}%</span></>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Hari Hadir</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{attendanceKpis.daysPresent}</div>
                  <div className="flex items-center text-xs">
                    {attendanceKpis.daysChange >= 0 ? (
                      <><ArrowUpRight className="h-3 w-3 text-green-500" /><span className="text-green-500">+{attendanceKpis.daysChange}%</span></>
                    ) : (
                      <><ArrowDownRight className="h-3 w-3 text-red-500" /><span className="text-red-500">{attendanceKpis.daysChange}%</span></>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Auto Clock-out</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">{attendanceKpis.autoClockoutDays}</div>
                  <p className="text-xs text-muted-foreground">Hari lupa clock-out</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Rata-rata Masuk</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{attendanceKpis.avgClockIn}</div>
                  <p className="text-xs text-muted-foreground">Jam masuk</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Rata-rata Pulang</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{attendanceKpis.avgClockOut}</div>
                  <p className="text-xs text-muted-foreground">Jam pulang</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Break</CardTitle>
                  <Coffee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(attendanceKpis.totalBreakMinutes / 60 * 10) / 10}h</div>
                  <p className="text-xs text-muted-foreground">{attendanceKpis.totalBreakMinutes} menit</p>
                </CardContent>
              </Card>
            </div>

            {/* Attendance Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <EmployeeAttendanceChart 
                attendance={attendance || []}
                startDate={startDate}
                endDate={endDate}
              />
              <EmployeeMonthComparison 
                currentAttendance={attendance || []}
                compareAttendance={compareAttendance || []}
                currentTasks={tasks || []}
                employeeId={employeeId || ''}
                currentMonth={format(new Date(startDate), 'MMM yyyy', { locale: idLocale })}
                compareMonth={format(new Date(compareMonth + '-01'), 'MMM yyyy', { locale: idLocale })}
              />
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            {/* Activity KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Task Dibuat</CardTitle>
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activityKpis.tasksCreated}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Task Selesai</CardTitle>
                  <CheckSquare className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{activityKpis.tasksCompleted}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Task Overdue</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{activityKpis.tasksOverdue}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Meeting</CardTitle>
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activityKpis.meetingCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Shooting</CardTitle>
                  <Video className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activityKpis.shootingCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Event</CardTitle>
                  <PartyPopper className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activityKpis.eventCount}</div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Charts */}
            <EmployeeActivityChart 
              tasks={tasks || []}
              meetings={meetings || []}
              shootings={shootings || []}
              events={events || []}
              employeeId={employeeId || ''}
            />
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <EmployeeProjectContribution 
              tasks={tasks || []}
              meetings={meetings || []}
              shootings={shootings || []}
              events={events || []}
              employeeId={employeeId || ''}
            />
          </TabsContent>

          {/* Insight Tab */}
          <TabsContent value="insight">
            <EmployeeInsightPanel 
              attendance={attendance || []}
              tasks={tasks || []}
              employeeId={employeeId || ''}
              attendanceKpis={attendanceKpis}
              activityKpis={activityKpis}
            />
          </TabsContent>

          {/* Daily Log Tab */}
          <TabsContent value="daily">
            <EmployeeDailyLog 
              attendance={attendance || []}
              tasks={tasks || []}
              meetings={meetings || []}
              shootings={shootings || []}
              events={events || []}
              employeeId={employeeId || ''}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
