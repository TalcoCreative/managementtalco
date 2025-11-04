import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const taskColumns = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export default function Tasks() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", selectedProject],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, projects(title, clients(name)), profiles(full_name)")
        .order("created_at", { ascending: false });

      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
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

    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["active-tasks"] });
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

  const canCreateTasks = userRole === "super_admin" || userRole === "hr";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Tasks</h1>
          <div className="flex items-center gap-4">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canCreateTasks && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : (
          <KanbanBoard
            columns={taskColumns}
            items={tasks || []}
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
                {task.projects?.clients && (
                  <p className="text-xs font-medium text-primary">
                    {task.projects.clients.name}
                  </p>
                )}
                {task.projects && (
                  <p className="text-xs text-muted-foreground">
                    Project: {task.projects.title}
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
        )}
      </div>

      <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      
      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </AppLayout>
  );
}
