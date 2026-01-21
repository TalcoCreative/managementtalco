import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, X, ListTodo, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface RelatedTasksSectionProps {
  shootingId: string;
  onTaskClick?: (taskId: string) => void;
}

export function RelatedTasksSection({ shootingId, onTaskClick }: RelatedTasksSectionProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch related tasks for this shooting
  const { data: relatedTasks } = useQuery({
    queryKey: ["shooting-related-tasks", shootingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_tasks")
        .select(`
          id,
          task_id,
          created_at,
          tasks:task_id (
            id,
            title,
            status,
            priority,
            deadline,
            projects(title, clients(name))
          )
        `)
        .eq("shooting_id", shootingId);
      if (error) throw error;
      return data;
    },
    enabled: !!shootingId,
  });

  // Fetch all tasks for search
  const { data: allTasks } = useQuery({
    queryKey: ["all-tasks-for-relation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          status,
          priority,
          deadline,
          projects(title, clients(name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  // Get IDs of already related tasks
  const relatedTaskIds = relatedTasks?.map((rt) => rt.task_id) || [];

  // Filter tasks based on search and exclude already related
  const filteredTasks = allTasks?.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const notAlreadyRelated = !relatedTaskIds.includes(task.id);
    return matchesSearch && notAlreadyRelated;
  }) || [];

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleAddRelatedTasks = async () => {
    if (selectedTaskIds.length === 0) return;

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const insertData = selectedTaskIds.map((taskId) => ({
        shooting_id: shootingId,
        task_id: taskId,
        created_by: userId,
      }));

      const { error } = await supabase.from("shooting_tasks").insert(insertData);
      if (error) throw error;

      toast.success(`${selectedTaskIds.length} task(s) linked successfully`);
      setSelectedTaskIds([]);
      setSearchTerm("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["shooting-related-tasks", shootingId] });
    } catch (error: any) {
      toast.error(error.message || "Failed to link tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRelatedTask = async (relationId: string) => {
    try {
      const { error } = await supabase.from("shooting_tasks").delete().eq("id", relationId);
      if (error) throw error;

      toast.success("Task unlinked");
      queryClient.invalidateQueries({ queryKey: ["shooting-related-tasks", shootingId] });
    } catch (error: any) {
      toast.error(error.message || "Failed to unlink task");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "in_progress": return "bg-blue-500";
      case "on_hold": return "bg-yellow-500";
      case "revise": return "bg-orange-500";
      default: return "bg-muted";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-muted";
    }
  };

  const isOverdue = (deadline: string | null, status: string) => {
    if (!deadline || status === "completed") return false;
    return new Date(deadline) < new Date();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Related Tasks</span>
          {relatedTasks && relatedTasks.length > 0 && (
            <Badge variant="secondary">{relatedTasks.length}</Badge>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Tasks
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Link Tasks to Shooting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {filteredTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {searchTerm ? "No tasks found" : "No available tasks"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleTaskSelection(task.id)}
                      >
                        <Checkbox
                          checked={selectedTaskIds.includes(task.id)}
                          onCheckedChange={() => toggleTaskSelection(task.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className={getStatusColor(task.status)} variant="secondary">
                              {task.status?.replace("_", " ")}
                            </Badge>
                            <Badge className={getPriorityColor(task.priority)} variant="secondary">
                              {task.priority}
                            </Badge>
                            {task.projects?.clients?.name && (
                              <span className="text-xs text-muted-foreground">
                                {task.projects.clients.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddRelatedTasks} disabled={selectedTaskIds.length === 0 || loading}>
                  {loading ? "Adding..." : `Add ${selectedTaskIds.length} Task(s)`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {relatedTasks && relatedTasks.length > 0 ? (
        <div className="space-y-2">
          {relatedTasks.map((relation) => {
            const task = relation.tasks as any;
            if (!task) return null;
            const overdue = isOverdue(task.deadline, task.status);

            return (
              <div
                key={relation.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 group"
              >
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onTaskClick?.(task.id)}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge 
                      className={overdue ? "bg-red-500" : getStatusColor(task.status)} 
                      variant="secondary"
                    >
                      {overdue ? "overdue" : task.status?.replace("_", " ")}
                    </Badge>
                    {task.deadline && (
                      <span className={`text-xs ${overdue ? "text-red-500" : "text-muted-foreground"}`}>
                        {format(new Date(task.deadline), "dd MMM yyyy")}
                      </span>
                    )}
                    {task.projects?.clients?.name && (
                      <span className="text-xs text-muted-foreground">
                        • {task.projects.clients.name}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveRelatedTask(relation.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
          No related tasks
        </p>
      )}
    </div>
  );
}
