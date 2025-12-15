import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Building2, User, CheckCircle2, Clock, AlertCircle, Users, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";

interface ProjectDetailDialogProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailDialog({ projectId, open, onOpenChange }: ProjectDetailDialogProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project-detail", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          clients(name),
          profiles(full_name)
        `)
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!projectId,
  });

  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*, profiles:profiles!fk_tasks_assigned_to_profiles(full_name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });


  const handleStatusChange = async (itemId: string, newStatus: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", itemId);

    if (error) {
      console.error("Error updating task:", error);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
  };

  const getTaskColumns = () => {
    const baseColumns = [
      { id: "pending", title: "Pending" },
      { id: "in_progress", title: "In Progress" },
      { id: "on_hold", title: "On Hold" },
      { id: "revise", title: "Revise" },
    ];
    
    if (showCompletedTasks) {
      baseColumns.push({ id: "completed", title: "Completed" });
    }
    
    return baseColumns;
  };

  // Filter out completed tasks when not showing them
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (showCompletedTasks) return tasks;
    return tasks.filter((task: any) => task.status !== "completed");
  }, [tasks, showCompletedTasks]);

  const completedTasksCount = useMemo(() => {
    if (!tasks) return 0;
    return tasks.filter((task: any) => task.status === "completed").length;
  }, [tasks]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-priority-high";
      case "medium":
        return "bg-priority-medium";
      case "low":
        return "bg-priority-low";
      default:
        return "bg-muted";
    }
  };

  const taskStats = useMemo(() => {
    if (!tasks) return { total: 0, byStatus: {} as Record<string, number>, assignedUsers: new Set(), completionRate: 0 };
    
    const byStatus: Record<string, number> = {};
    const assignedUsers = new Set<string>();
    
    tasks.forEach((task: any) => {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      if (task.profiles?.full_name) {
        assignedUsers.add(task.profiles.full_name);
      }
    });

    const completedCount = byStatus.completed || 0;
    const completionRate = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

    return {
      total: tasks.length,
      byStatus,
      assignedUsers,
      completionRate: Math.round(completionRate)
    };
  }, [tasks]);

  const getCardColor = (task: any) => {
    switch (task.priority) {
      case "high":
        return "border-l-4 border-l-priority-high bg-gradient-to-r from-priority-high/5 to-transparent";
      case "medium":
        return "border-l-4 border-l-priority-medium bg-gradient-to-r from-priority-medium/5 to-transparent";
      case "low":
        return "border-l-4 border-l-priority-low bg-gradient-to-r from-priority-low/5 to-transparent";
      default:
        return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-status-completed";
      case "in_progress":
        return "bg-status-in-progress";
      case "on_hold":
        return "bg-status-on-hold";
      default:
        return "bg-status-pending";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      in_progress: "In Progress",
      completed: "Completed",
      on_hold: "On Hold",
      revise: "Revise"
    };
    return labels[status] || status;
  };

  

  if (!project) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-2xl">{project.title}</DialogTitle>
              <Badge className={getStatusColor(project.status)}>
                {project.status?.replace("_", " ")}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Project Info */}
            <div className="space-y-3">
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                {project.clients && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{project.clients.name}</span>
                  </div>
                )}
                
                {project.profiles && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{project.profiles.full_name}</span>
                  </div>
                )}

                {project.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(project.deadline), "PPP")}</span>
                  </div>
                )}

                {project.type && (
                  <div className="text-xs text-muted-foreground">
                    Type: {project.type}
                  </div>
                )}
              </div>
            </div>

            {/* Dashboard Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{taskStats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{taskStats.completionRate}%</div>
                  <Progress value={taskStats.completionRate} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {taskStats.byStatus.in_progress || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{taskStats.assignedUsers.size}</div>
                </CardContent>
              </Card>
            </div>

            {/* Task Status Breakdown */}
            {taskStats.total > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Task Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {Object.entries(taskStats.byStatus).map(([status, count]) => (
                      <div key={status} className="text-center">
                        <div className="text-2xl font-bold text-primary">{count}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {getStatusLabel(status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tasks Overview (Read Only) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h3 className="font-semibold text-lg">Tasks Overview</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                    className="h-9"
                  >
                    {showCompletedTasks ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Sembunyikan Completed ({completedTasksCount})
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Tampilkan Completed ({completedTasksCount})
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    Kelola task di halaman Tasks
                  </p>
                </div>
              </div>

              {filteredTasks && filteredTasks.length > 0 ? (
                <KanbanBoard
                  columns={getTaskColumns()}
                  items={filteredTasks}
                  onStatusChange={handleStatusChange}
                  onCardClick={(task) => setSelectedTaskId(task.id)}
                  getCardColor={getCardColor}
                  renderCard={(task) => (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium flex-1">{task.title}</h4>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      {task.deadline && (
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(task.deadline).toLocaleDateString()}
                        </p>
                      )}
                      {task.profiles && (
                        <p className="text-xs text-muted-foreground">
                          Assigned: {task.profiles.full_name}
                        </p>
                      )}
                    </div>
                  )}
                />
              ) : tasks && tasks.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Semua tasks sudah completed. Klik "Tampilkan Completed" untuk melihat.
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks yet. Create your first task!
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </>
  );
}
