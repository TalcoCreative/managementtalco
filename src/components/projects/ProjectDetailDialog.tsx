import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Building2, User, Plus } from "lucide-react";
import { format } from "date-fns";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";

interface ProjectDetailDialogProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailDialog({ projectId, open, onOpenChange }: ProjectDetailDialogProps) {
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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
        .select("*, profiles(full_name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id)
        .single();

      return data?.role;
    },
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
    const isSocmedOrDigital = project?.type?.toLowerCase().includes("socmed") || 
                              project?.type?.toLowerCase().includes("digital");
    
    if (isSocmedOrDigital) {
      return [
        { id: "writing", title: "Writing" },
        { id: "editing", title: "Editing" },
        { id: "posting", title: "Posting" },
        { id: "done", title: "Done" },
      ];
    }
    
    return [
      { id: "todo", title: "To Do" },
      { id: "in_progress", title: "In Progress" },
      { id: "done", title: "Done" },
    ];
  };

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

  const canManageTasks = userRole === "super_admin" || userRole === "hr";

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

            {/* Tasks Kanban */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Tasks</h3>
                {canManageTasks && (
                  <Button onClick={() => setCreateTaskDialogOpen(true)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Task
                  </Button>
                )}
              </div>

              {tasks && tasks.length > 0 ? (
                <KanbanBoard
                  columns={getTaskColumns()}
                  items={tasks}
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
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks yet. Create your first task!
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {projectId && (
        <CreateTaskDialog
          open={createTaskDialogOpen}
          onOpenChange={setCreateTaskDialogOpen}
          defaultProjectId={projectId}
        />
      )}

      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </>
  );
}
