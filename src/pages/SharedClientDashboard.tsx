import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle2, Clock, FolderOpen, AlertTriangle, 
  Calendar, X, ChevronDown, Building2, AlertCircle, 
  TrendingUp, ListTodo
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface ClientDashboardData {
  client: {
    name: string;
    company: string | null;
  };
  projects: Array<{
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    created_at: string;
    totalTasks: number;
    completedTasks: number;
    isDelayed: boolean;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    deadline: string | null;
    priority: string | null;
    project_id: string;
    created_at: string;
  }>;
  analytics: {
    totalProjects: number;
    completedProjects: number;
    inProgressProjects: number;
    delayedProjects: number;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    upcomingDeadlines: number;
  };
}

export default function SharedClientDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const today = new Date();
  const oneMonthAgo = subMonths(today, 1);
  
  const [startDate, setStartDate] = useState(format(startOfMonth(oneMonthAgo), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deadline");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  const { data, isLoading, error, refetch } = useQuery<ClientDashboardData>({
    queryKey: ["shared-client-dashboard", slug, startDate, endDate, statusFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("slug", slug || "");
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      params.set("sortBy", sortBy);

      const { data: response, error } = await supabase.functions.invoke(
        "shared-client-dashboard",
        { body: null, headers: {}, method: "GET" }
      );

      // Use fetch directly for GET with params
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${baseUrl}/functions/v1/shared-client-dashboard?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch dashboard");
      }

      return res.json();
    },
    enabled: !!slug,
    refetchInterval: 30000, // Live update every 30 seconds
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!slug) return;

    const channel = supabase
      .channel("client-dashboard-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, refetch]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const setDefaultFilter = () => {
    setStartDate(format(startOfMonth(oneMonthAgo), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
  };

  const getStatusBadge = (status: string, isDelayed?: boolean) => {
    if (isDelayed) {
      return <Badge variant="destructive">Delay</Badge>;
    }
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Todo" },
      in_progress: { variant: "default", label: "On Progress" },
      completed: { variant: "secondary", label: "Completed" },
      on_hold: { variant: "destructive", label: "On Hold" },
      revise: { variant: "destructive", label: "Revise" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getProjectStatusBadge = (status: string, isDelayed?: boolean) => {
    if (isDelayed) {
      return <Badge variant="destructive">Delay</Badge>;
    }
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      in_progress: { variant: "default", label: "On Progress" },
      completed: { variant: "secondary", label: "Completed" },
      on_hold: { variant: "destructive", label: "On Hold" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Dashboard Tidak Ditemukan</h1>
          <p className="text-muted-foreground">Link dashboard tidak valid atau sudah tidak aktif.</p>
        </div>
      </div>
    );
  }

  const { client, projects, tasks, analytics } = data;
  const taskProgress = analytics.totalTasks > 0 
    ? (analytics.completedTasks / analytics.totalTasks) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{client.name}</h1>
              {client.company && (
                <p className="text-sm text-muted-foreground">{client.company}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Dari</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-36"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Sampai</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-36"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="pending">Todo</SelectItem>
                      <SelectItem value="in_progress">On Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Urutkan</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deadline">Deadline</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={setDefaultFilter} className="h-9 text-xs">
                  1 Bulan
                </Button>
                {(startDate || endDate) && (
                  <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-9 text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Analytics */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Total Project</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold">{analytics.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.inProgressProjects} berjalan, {analytics.completedProjects} selesai
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Total Task</CardTitle>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold">{analytics.totalTasks}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.inProgressTasks} berjalan
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Deadline Dekat</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-warning">{analytics.upcomingDeadlines}</div>
              <p className="text-xs text-muted-foreground">dalam 3 hari</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-destructive">{analytics.overdueTasks}</div>
              <p className="text-xs text-muted-foreground">melewati deadline</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Overview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Progress Keseluruhan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={taskProgress} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{analytics.completedTasks} dari {analytics.totalTasks} task selesai</span>
              <span>{taskProgress.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Task Status Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status Task</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                <Clock className="h-5 w-5 mx-auto text-muted-foreground" />
                <div className="text-xl font-bold">{analytics.pendingTasks}</div>
                <p className="text-xs text-muted-foreground">Todo</p>
              </div>
              <div className="space-y-1 p-3 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 mx-auto text-primary" />
                <div className="text-xl font-bold">{analytics.inProgressTasks}</div>
                <p className="text-xs text-muted-foreground">On Progress</p>
              </div>
              <div className="space-y-1 p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
                <div className="text-xl font-bold">{analytics.completedTasks}</div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="space-y-1 p-3 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 mx-auto text-destructive" />
                <div className="text-xl font-bold">{analytics.overdueTasks}</div>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects with Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Project Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length > 0 ? (
              <div className="space-y-3">
                {projects.map((project) => {
                  const projectTasks = tasks.filter(t => t.project_id === project.id);
                  const isExpanded = expandedProjects[project.id];
                  const projectProgress = project.totalTasks > 0 
                    ? (project.completedTasks / project.totalTasks) * 100 
                    : 0;

                  return (
                    <Collapsible
                      key={project.id}
                      open={isExpanded}
                      onOpenChange={() => toggleProject(project.id)}
                    >
                      <div className="border rounded-lg">
                        <CollapsibleTrigger asChild>
                          <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium">{project.title}</h3>
                                  {getProjectStatusBadge(project.status, project.isDelayed)}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Dibuat: {format(new Date(project.created_at), "dd MMM yyyy")}
                                  </span>
                                  <span>{project.completedTasks}/{project.totalTasks} task</span>
                                  {project.deadline && (
                                    <span>Deadline: {format(new Date(project.deadline), "dd MMM yyyy")}</span>
                                  )}
                                </div>
                                <Progress value={projectProgress} className="h-1.5 mt-2" />
                              </div>
                              <ChevronDown 
                                className={`h-5 w-5 text-muted-foreground transition-transform ml-4 ${
                                  isExpanded ? "rotate-180" : ""
                                }`} 
                              />
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t px-4 py-3 bg-muted/30">
                            {projectTasks.length > 0 ? (
                              <div className="space-y-2">
                                {projectTasks.map((task) => {
                                  const isOverdue = task.deadline && 
                                    new Date(task.deadline) < new Date() && 
                                    task.status !== "completed";

                                    return (
                                     <div 
                                       key={task.id}
                                       className={`flex items-center justify-between p-2 rounded-md bg-background border ${
                                         isOverdue ? "border-destructive/50" : ""
                                       }`}
                                     >
                                       <div className="space-y-0.5">
                                         <p className="text-sm font-medium">{task.title}</p>
                                         <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                           {task.created_at && (
                                             <span>Dibuat: {format(new Date(task.created_at), "dd MMM yyyy")}</span>
                                           )}
                                           {task.deadline && (
                                             <span className={isOverdue ? "text-destructive" : ""}>
                                               {isOverdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                               Deadline: {format(new Date(task.deadline), "dd MMM yyyy")}
                                             </span>
                                           )}
                                         </div>
                                       </div>
                                       {getStatusBadge(task.status, isOverdue)}
                                     </div>
                                   );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                Tidak ada task dalam filter ini
                              </p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Tidak ada project dalam periode ini
              </p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          Dashboard diperbarui secara otomatis • Talco System
        </div>
      </main>
    </div>
  );
}
