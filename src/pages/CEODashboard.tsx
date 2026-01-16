import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  BarChart3, 
  ArrowLeft,
  CalendarIcon,
  ClipboardList,
  Video,
  PartyPopper,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface ClientResourceData {
  clientId: string;
  clientName: string;
  company: string | null;
  totalActivities: number;
  workloadPercentage: number;
  estimatedCost: number;
  taskCount: number;
  meetingCount: number;
  shootingCount: number;
  eventCount: number;
  employeeBreakdown: EmployeeBreakdown[];
}

interface EmployeeBreakdown {
  employeeId: string;
  employeeName: string;
  totalActivities: number;
  activitiesForClient: number;
  percentageForClient: number;
  monthlySalary: number;
  estimatedCostForClient: number;
}

export default function CEODashboard() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedClient, setSelectedClient] = useState<ClientResourceData | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  // Check if user is super_admin
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["ceo-dashboard-roles"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id);

      return data?.map((r) => r.role) || [];
    },
  });

  const isSuperAdmin = userRoles?.includes("super_admin");

  useEffect(() => {
    if (!rolesLoading && !isSuperAdmin && userRoles && userRoles.length >= 0) {
      navigate("/");
    }
  }, [rolesLoading, isSuperAdmin, userRoles, navigate]);

  // Fetch all profiles with salary
  const { data: profiles } = useQuery({
    queryKey: ["ceo-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, salary, gaji_pokok, tj_transport, tj_internet, tj_kpi, status")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Fetch all clients (only external clients for resource calculation)
  const { data: clients } = useQuery({
    queryKey: ["ceo-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, client_type")
        .eq("client_type", "client"); // Only external clients
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Fetch projects for filtering
  const { data: projects } = useQuery({
    queryKey: ["ceo-projects", selectedClient?.clientId],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .eq("client_id", selectedClient.clientId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClient,
  });

  // Format date range for queries
  const formattedDateRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      const now = new Date();
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    return {
      start: format(dateRange.from, "yyyy-MM-dd"),
      end: format(dateRange.to, "yyyy-MM-dd"),
    };
  }, [dateRange]);

  // Fetch tasks within date range
  const { data: tasks } = useQuery({
    queryKey: ["ceo-tasks", formattedDateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id, assigned_to, project_id, created_at,
          project:projects(client_id)
        `)
        .gte("created_at", formattedDateRange.start)
        .lte("created_at", formattedDateRange.end + "T23:59:59");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Fetch meetings with participants within date range
  const { data: meetings } = useQuery({
    queryKey: ["ceo-meetings", formattedDateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          id, client_id, project_id, meeting_date,
          meeting_participants(user_id)
        `)
        .gte("meeting_date", formattedDateRange.start)
        .lte("meeting_date", formattedDateRange.end);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Fetch shootings with crew within date range
  const { data: shootings } = useQuery({
    queryKey: ["ceo-shootings", formattedDateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select(`
          id, client_id, project_id, scheduled_date,
          shooting_crew(user_id, is_freelance)
        `)
        .gte("scheduled_date", formattedDateRange.start)
        .lte("scheduled_date", formattedDateRange.end);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Fetch events with crew within date range
  const { data: events } = useQuery({
    queryKey: ["ceo-events", formattedDateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          id, client_id, project_id, pic_id, start_date,
          event_crew(user_id, crew_type)
        `)
        .gte("start_date", formattedDateRange.start)
        .lte("start_date", formattedDateRange.end);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Calculate resource data
  const clientResourceData = useMemo(() => {
    if (!profiles || !clients || !tasks || !meetings || !shootings || !events) {
      return [];
    }

    // Create a map for employee activities
    const employeeActivities: Map<string, { 
      total: number; 
      byClient: Map<string, { count: number; taskCount: number; meetingCount: number; shootingCount: number; eventCount: number }> 
    }> = new Map();

    // Initialize employee activities
    profiles.forEach((profile) => {
      employeeActivities.set(profile.id, { total: 0, byClient: new Map() });
    });

    // Helper to get or create client entry
    const getOrCreateClientEntry = (employeeId: string, clientId: string) => {
      const emp = employeeActivities.get(employeeId);
      if (!emp) return null;
      if (!emp.byClient.has(clientId)) {
        emp.byClient.set(clientId, { count: 0, taskCount: 0, meetingCount: 0, shootingCount: 0, eventCount: 0 });
      }
      return emp.byClient.get(clientId)!;
    };

    // Process tasks
    tasks.forEach((task) => {
      if (!task.assigned_to) return;
      const clientId = (task.project as any)?.client_id;
      if (!clientId) return;
      
      const emp = employeeActivities.get(task.assigned_to);
      if (emp) {
        emp.total++;
        const clientEntry = getOrCreateClientEntry(task.assigned_to, clientId);
        if (clientEntry) {
          clientEntry.count++;
          clientEntry.taskCount++;
        }
      }
    });

    // Process meetings
    meetings.forEach((meeting) => {
      const clientId = meeting.client_id;
      if (!clientId) return;
      
      const participants = (meeting as any).meeting_participants || [];
      participants.forEach((p: any) => {
        if (!p.user_id) return;
        const emp = employeeActivities.get(p.user_id);
        if (emp) {
          emp.total++;
          const clientEntry = getOrCreateClientEntry(p.user_id, clientId);
          if (clientEntry) {
            clientEntry.count++;
            clientEntry.meetingCount++;
          }
        }
      });
    });

    // Process shootings
    shootings.forEach((shooting) => {
      const clientId = shooting.client_id;
      if (!clientId) return;
      
      const crew = (shooting as any).shooting_crew || [];
      crew.forEach((c: any) => {
        if (!c.user_id || c.is_freelance) return;
        const emp = employeeActivities.get(c.user_id);
        if (emp) {
          emp.total++;
          const clientEntry = getOrCreateClientEntry(c.user_id, clientId);
          if (clientEntry) {
            clientEntry.count++;
            clientEntry.shootingCount++;
          }
        }
      });
    });

    // Process events
    events.forEach((event) => {
      const clientId = event.client_id;
      if (!clientId) return;
      
      // Add PIC
      if (event.pic_id) {
        const emp = employeeActivities.get(event.pic_id);
        if (emp) {
          emp.total++;
          const clientEntry = getOrCreateClientEntry(event.pic_id, clientId);
          if (clientEntry) {
            clientEntry.count++;
            clientEntry.eventCount++;
          }
        }
      }
      
      // Add crew (internal only)
      const crew = (event as any).event_crew || [];
      crew.forEach((c: any) => {
        if (!c.user_id || c.crew_type === "freelancer") return;
        const emp = employeeActivities.get(c.user_id);
        if (emp) {
          emp.total++;
          const clientEntry = getOrCreateClientEntry(c.user_id, clientId);
          if (clientEntry) {
            clientEntry.count++;
            clientEntry.eventCount++;
          }
        }
      });
    });

    // Calculate total activities across all employees
    let totalCompanyActivities = 0;
    employeeActivities.forEach((emp) => {
      totalCompanyActivities += emp.total;
    });

    // Build client resource data
    const clientDataMap = new Map<string, ClientResourceData>();

    clients.forEach((client) => {
      const data: ClientResourceData = {
        clientId: client.id,
        clientName: client.name,
        company: client.company,
        totalActivities: 0,
        workloadPercentage: 0,
        estimatedCost: 0,
        taskCount: 0,
        meetingCount: 0,
        shootingCount: 0,
        eventCount: 0,
        employeeBreakdown: [],
      };

      profiles.forEach((profile) => {
        const emp = employeeActivities.get(profile.id);
        if (!emp) return;
        
        const clientStats = emp.byClient.get(client.id);
        if (!clientStats || clientStats.count === 0) return;

        const monthlySalary = (profile.gaji_pokok || 0) + 
          (profile.tj_transport || 0) + 
          (profile.tj_internet || 0) + 
          (profile.tj_kpi || 0) || 
          (profile.salary || 0);

        const percentage = emp.total > 0 ? (clientStats.count / emp.total) * 100 : 0;
        const costForClient = (percentage / 100) * monthlySalary;

        data.totalActivities += clientStats.count;
        data.taskCount += clientStats.taskCount;
        data.meetingCount += clientStats.meetingCount;
        data.shootingCount += clientStats.shootingCount;
        data.eventCount += clientStats.eventCount;
        data.estimatedCost += costForClient;

        data.employeeBreakdown.push({
          employeeId: profile.id,
          employeeName: profile.full_name,
          totalActivities: emp.total,
          activitiesForClient: clientStats.count,
          percentageForClient: percentage,
          monthlySalary,
          estimatedCostForClient: costForClient,
        });
      });

      if (totalCompanyActivities > 0) {
        data.workloadPercentage = (data.totalActivities / totalCompanyActivities) * 100;
      }

      if (data.totalActivities > 0) {
        clientDataMap.set(client.id, data);
      }
    });

    // Sort by estimated cost descending
    const sortedData = Array.from(clientDataMap.values()).sort(
      (a, b) => b.estimatedCost - a.estimatedCost
    );

    return sortedData;
  }, [profiles, clients, tasks, meetings, shootings, events]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get status color based on workload
  const getStatusColor = (percentage: number) => {
    if (percentage >= 30) return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400", icon: AlertTriangle };
    if (percentage >= 15) return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-600 dark:text-yellow-400", icon: AlertCircle };
    return { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400", icon: CheckCircle };
  };

  // Calculate totals
  const totals = useMemo(() => {
    return clientResourceData.reduce(
      (acc, client) => {
        acc.totalActivities += client.totalActivities;
        acc.totalCost += client.estimatedCost;
        return acc;
      },
      { totalActivities: 0, totalCost: 0 }
    );
  }, [clientResourceData]);

  if (rolesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {selectedClient && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedClient(null);
                  setSelectedProjectId("all");
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold">
                {selectedClient ? `Detail: ${selectedClient.clientName}` : "CEO Dashboard"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {selectedClient
                  ? "Breakdown resource & cost untuk klien ini"
                  : "Client Resource & Cost Intelligence"}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd MMM yyyy", { locale: localeId })} -{" "}
                        {format(dateRange.to, "dd MMM yyyy", { locale: localeId })}
                      </>
                    ) : (
                      format(dateRange.from, "dd MMM yyyy", { locale: localeId })
                    )
                  ) : (
                    <span>Pilih rentang tanggal</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {selectedClient && projects && projects.length > 0 && (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Semua Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {!selectedClient && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Klien Aktif</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientResourceData.length}</div>
                <p className="text-xs text-muted-foreground">
                  {dateRange?.from && dateRange?.to ? (
                    <>
                      {format(dateRange.from, "dd MMM", { locale: localeId })} - {format(dateRange.to, "dd MMM yyyy", { locale: localeId })}
                    </>
                  ) : "Bulan ini"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Aktivitas</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.totalActivities}</div>
                <p className="text-xs text-muted-foreground">
                  Task, Meeting, Shooting, Event
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Est. Resource Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totals.totalCost)}</div>
                <p className="text-xs text-muted-foreground">
                  Estimasi biaya SDM bulan ini
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detail View for Selected Client */}
        {selectedClient && (
          <div className="space-y-6">
            {/* Client Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Aktivitas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedClient.totalActivities}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Porsi Resource</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {selectedClient.workloadPercentage.toFixed(1)}%
                  </div>
                  <Progress value={selectedClient.workloadPercentage} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Est. Biaya SDM</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(selectedClient.estimatedCost)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Jumlah Karyawan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {selectedClient.employeeBreakdown.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Breakdown Per Aktivitas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <ClipboardList className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{selectedClient.taskCount}</p>
                      <p className="text-sm text-muted-foreground">Tasks</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <MessageSquare className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{selectedClient.meetingCount}</p>
                      <p className="text-sm text-muted-foreground">Meetings</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <Video className="h-8 w-8 text-purple-500" />
                    <div>
                      <p className="text-2xl font-bold">{selectedClient.shootingCount}</p>
                      <p className="text-sm text-muted-foreground">Shootings</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <PartyPopper className="h-8 w-8 text-orange-500" />
                    <div>
                      <p className="text-2xl font-bold">{selectedClient.eventCount}</p>
                      <p className="text-sm text-muted-foreground">Events</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Breakdown Per Karyawan</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Karyawan</TableHead>
                      <TableHead className="text-center">Total Aktivitas</TableHead>
                      <TableHead className="text-center">Porsi % untuk Klien</TableHead>
                      <TableHead className="text-right">Gaji Bulanan</TableHead>
                      <TableHead className="text-right">Est. Cost untuk Klien</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedClient.employeeBreakdown
                      .sort((a, b) => b.estimatedCostForClient - a.estimatedCostForClient)
                      .map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell className="font-medium">{emp.employeeName}</TableCell>
                          <TableCell className="text-center">{emp.activitiesForClient}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              {emp.percentageForClient.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(emp.monthlySalary)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {formatCurrency(emp.estimatedCostForClient)}
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4} className="text-right">
                        Total Estimasi Biaya:
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {formatCurrency(selectedClient.estimatedCost)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Global Overview Table */}
        {!selectedClient && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Client Resource Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientResourceData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Tidak ada data aktivitas untuk periode ini</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-center">Total Workload %</TableHead>
                      <TableHead className="text-center">Total Activities</TableHead>
                      <TableHead className="text-right">Est. Resource Cost</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientResourceData.map((client, index) => {
                      const status = getStatusColor(client.workloadPercentage);
                      const StatusIcon = status.icon;

                      return (
                        <TableRow
                          key={client.clientId}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedClient(client)}
                        >
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{client.clientName}</p>
                              {client.company && (
                                <p className="text-sm text-muted-foreground">{client.company}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Progress 
                                value={client.workloadPercentage} 
                                className="w-20 h-2" 
                              />
                              <span className="text-sm font-medium w-12">
                                {client.workloadPercentage.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 text-sm">
                              <span className="text-blue-500">{client.taskCount}T</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-green-500">{client.meetingCount}M</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-purple-500">{client.shootingCount}S</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-orange-500">{client.eventCount}E</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(client.estimatedCost)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center">
                              <Badge className={`${status.bg} ${status.text} border-0`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {client.workloadPercentage >= 30
                                  ? "High"
                                  : client.workloadPercentage >= 15
                                  ? "Medium"
                                  : "Normal"}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer Info */}
        <div className="text-xs text-muted-foreground text-center">
          <p>
            Data terakhir dikalkulasi: {format(new Date(), "d MMMM yyyy, HH:mm", { locale: localeId })}
          </p>
          <p className="mt-1">
            * Dashboard ini merupakan Business Intelligence Tool, bukan laporan akuntansi legal.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
