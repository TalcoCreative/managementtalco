import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, Users, FolderOpen, AlertCircle, Pause, Calendar, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

interface ClientDashboardDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDashboardDialog({ clientId, open, onOpenChange }: ClientDashboardDialogProps) {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: projects } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles:profiles!fk_projects_assigned_to(full_name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: tasks } = useQuery({
    queryKey: ["client-tasks", clientId],
    queryFn: async () => {
      if (!projects || projects.length === 0) return [];
      const projectIds = projects.map(p => p.id);
      const { data, error } = await supabase
        .from("tasks")
        .select("*, profiles:profiles!fk_tasks_assigned_to_profiles(full_name)")
        .in("project_id", projectIds);
      if (error) throw error;
      return data;
    },
    enabled: !!projects && projects.length > 0,
  });

  // Filter data by date range
  const filterByDateRange = (items: any[] | undefined, dateField: string = "created_at") => {
    if (!items) return [];
    if (!startDate || !endDate) return items;
    
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    end.setHours(23, 59, 59, 999);
    
    return items.filter(item => {
      const itemDate = parseISO(item[dateField]);
      return isWithinInterval(itemDate, { start, end });
    });
  };

  const filteredProjects = filterByDateRange(projects);
  const filteredTasks = filterByDateRange(tasks);

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
  };

  // Calculate stats from filtered data
  const totalProjects = filteredProjects.length;
  const completedProjects = filteredProjects.filter(p => p.status === "completed").length;
  const inProgressProjects = filteredProjects.filter(p => p.status === "in_progress").length;

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === "completed").length;
  const inProgressTasks = filteredTasks.filter(t => t.status === "in_progress").length;
  const pendingTasks = filteredTasks.filter(t => t.status === "pending").length;
  const reviseTasks = filteredTasks.filter(t => t.status === "revise").length;
  const onHoldTasks = filteredTasks.filter(t => t.status === "on_hold").length;

  const projectProgress = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Get unique team members from filtered tasks
  const teamMembers = new Map<string, { name: string; taskCount: number; completedCount: number }>();
  filteredTasks.forEach(task => {
    if (task.assigned_to && task.profiles) {
      const existing = teamMembers.get(task.assigned_to);
      if (existing) {
        existing.taskCount++;
        if (task.status === "completed") existing.completedCount++;
      } else {
        teamMembers.set(task.assigned_to, {
          name: task.profiles.full_name,
          taskCount: 1,
          completedCount: task.status === "completed" ? 1 : 0,
        });
      }
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      in_progress: { variant: "default", label: "In Progress" },
      completed: { variant: "secondary", label: "Completed" },
      on_hold: { variant: "destructive", label: "On Hold" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl">{client?.name} - Dashboard</DialogTitle>
          {client?.company && (
            <p className="text-sm text-muted-foreground">{client.company}</p>
          )}
        </DialogHeader>

        {/* Date Range Filter */}
        <div className="flex-shrink-0 flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter Periode:</span>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Dari</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-36"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sampai</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-36"
              />
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={setThisMonth} className="h-8 text-xs">
              Bulan Ini
            </Button>
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-8 text-xs">
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            {/* Overview Stats */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Total Projects</CardTitle>
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-xl font-bold">{totalProjects}</div>
                  <p className="text-xs text-muted-foreground">{completedProjects} completed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Total Tasks</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-xl font-bold">{totalTasks}</div>
                  <p className="text-xs text-muted-foreground">{completedTasks} completed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">In Progress</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-xl font-bold">{inProgressTasks}</div>
                  <p className="text-xs text-muted-foreground">{pendingTasks} pending</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Team Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-xl font-bold">{teamMembers.size}</div>
                  <p className="text-xs text-muted-foreground">active contributors</p>
                </CardContent>
              </Card>
            </div>

            {/* Progress Section */}
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Project Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3">
                  <Progress value={projectProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {completedProjects} of {totalProjects} projects completed ({projectProgress.toFixed(0)}%)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Task Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3">
                  <Progress value={taskProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {completedTasks} of {totalTasks} tasks completed ({taskProgress.toFixed(0)}%)
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Task Status Breakdown */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-medium">Task Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="space-y-1">
                    <Clock className="h-4 w-4 mx-auto text-muted-foreground" />
                    <div className="text-lg font-bold">{pendingTasks}</div>
                    <p className="text-[10px] text-muted-foreground">Pending</p>
                  </div>
                  <div className="space-y-1">
                    <Clock className="h-4 w-4 mx-auto text-primary" />
                    <div className="text-lg font-bold">{inProgressTasks}</div>
                    <p className="text-[10px] text-muted-foreground">In Progress</p>
                  </div>
                  <div className="space-y-1">
                    <CheckCircle2 className="h-4 w-4 mx-auto text-success" />
                    <div className="text-lg font-bold">{completedTasks}</div>
                    <p className="text-[10px] text-muted-foreground">Completed</p>
                  </div>
                  <div className="space-y-1">
                    <Pause className="h-4 w-4 mx-auto text-warning" />
                    <div className="text-lg font-bold">{onHoldTasks}</div>
                    <p className="text-[10px] text-muted-foreground">On Hold</p>
                  </div>
                  <div className="space-y-1">
                    <AlertCircle className="h-4 w-4 mx-auto text-destructive" />
                    <div className="text-lg font-bold">{reviseTasks}</div>
                    <p className="text-[10px] text-muted-foreground">Revise</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Members */}
            {teamMembers.size > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Team Contributions</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-3">
                    {Array.from(teamMembers.entries()).map(([id, member]) => (
                      <div key={id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {member.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.completedCount}/{member.taskCount} tasks
                            </p>
                          </div>
                        </div>
                        <div className="w-20">
                          <Progress 
                            value={member.taskCount > 0 ? (member.completedCount / member.taskCount) * 100 : 0} 
                            className="h-1.5" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Projects List */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-medium">Projects</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {filteredProjects.length > 0 ? (
                  <div className="space-y-2">
                    {filteredProjects.map((project) => {
                      const projectTasks = filteredTasks.filter(t => t.project_id === project.id);
                      const projectCompleted = projectTasks.filter(t => t.status === "completed").length;
                      const projectTotal = projectTasks.length;
                      
                      return (
                        <div 
                          key={project.id} 
                          className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">{project.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{projectCompleted}/{projectTotal} tasks</span>
                              {project.profiles && (
                                <span>• {project.profiles.full_name}</span>
                              )}
                            </div>
                          </div>
                          {getStatusBadge(project.status)}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4 text-sm">
                    {projects?.length ? "Tidak ada project di periode ini" : "Belum ada project"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
