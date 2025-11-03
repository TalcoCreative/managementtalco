import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Badge } from "@/components/ui/badge";

const taskColumns = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export default function Projects() {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title), profiles(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Tasks</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : (
          <KanbanBoard
            columns={taskColumns}
            items={tasks || []}
            onStatusChange={handleStatusChange}
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
    </AppLayout>
  );
}
