import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, Clock, Users, FolderOpen, AlertCircle, Pause } from "lucide-react";

interface ClientDashboardDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDashboardDialog({ clientId, open, onOpenChange }: ClientDashboardDialogProps) {
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

  // Calculate stats
  const totalProjects = projects?.length || 0;
  const completedProjects = projects?.filter(p => p.status === "completed").length || 0;
  const inProgressProjects = projects?.filter(p => p.status === "in_progress").length || 0;

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter(t => t.status === "completed").length || 0;
  const inProgressTasks = tasks?.filter(t => t.status === "in_progress").length || 0;
  const pendingTasks = tasks?.filter(t => t.status === "pending").length || 0;
  const reviseTasks = tasks?.filter(t => t.status === "revise").length || 0;
  const onHoldTasks = tasks?.filter(t => t.status === "on_hold").length || 0;

  const projectProgress = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Get unique team members
  const teamMembers = new Map<string, { name: string; taskCount: number; completedCount: number }>();
  tasks?.forEach(task => {
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{client?.name} - Dashboard</DialogTitle>
          {client?.company && (
            <p className="text-muted-foreground">{client.company}</p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalProjects}</div>
                <p className="text-xs text-muted-foreground">
                  {completedProjects} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTasks}</div>
                <p className="text-xs text-muted-foreground">
                  {completedTasks} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inProgressTasks}</div>
                <p className="text-xs text-muted-foreground">
                  {pendingTasks} pending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamMembers.size}</div>
                <p className="text-xs text-muted-foreground">
                  active contributors
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Section */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Project Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={projectProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {completedProjects} of {totalProjects} projects completed ({projectProgress.toFixed(0)}%)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={taskProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {completedTasks} of {totalTasks} tasks completed ({taskProgress.toFixed(0)}%)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Task Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Task Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4 text-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{pendingTasks}</div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">{inProgressTasks}</div>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-2xl font-bold">{completedTasks}</div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <Pause className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div className="text-2xl font-bold">{onHoldTasks}</div>
                  <p className="text-xs text-muted-foreground">On Hold</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="text-2xl font-bold">{reviseTasks}</div>
                  <p className="text-xs text-muted-foreground">Revise</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Members */}
          {teamMembers.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Team Contributions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from(teamMembers.entries()).map(([id, member]) => (
                    <div key={id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.completedCount} of {member.taskCount} tasks completed
                          </p>
                        </div>
                      </div>
                      <div className="w-24">
                        <Progress 
                          value={member.taskCount > 0 ? (member.completedCount / member.taskCount) * 100 : 0} 
                          className="h-2" 
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
            <CardHeader>
              <CardTitle className="text-sm font-medium">Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {projects && projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((project) => {
                    const projectTasks = tasks?.filter(t => t.project_id === project.id) || [];
                    const projectCompleted = projectTasks.filter(t => t.status === "completed").length;
                    const projectTotal = projectTasks.length;
                    
                    return (
                      <div 
                        key={project.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{project.title}</p>
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
                <p className="text-muted-foreground text-center py-4">No projects yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
