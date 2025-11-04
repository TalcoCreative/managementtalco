import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Building2, User, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface TaskDetailDialogProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ taskId, open, onOpenChange }: TaskDetailDialogProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: task } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          projects(title, clients(name)),
          profiles(full_name),
          created_by_profile:profiles!tasks_created_by_fkey(full_name)
        `)
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!taskId,
  });

  const { data: comments } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!taskId,
  });

  const handleSubmitComment = async () => {
    if (!comment.trim() || !taskId) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("comments").insert({
        content: comment,
        task_id: taskId,
        author_id: session.session.user.id,
      });

      if (error) throw error;

      toast.success("Comment added!");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
    } catch (error: any) {
      toast.error(error.message || "Failed to add comment");
    } finally {
      setLoading(false);
    }
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

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-2xl">{task.title}</DialogTitle>
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Task Info */}
            <div className="space-y-3">
              {task.description && (
                <p className="text-muted-foreground">{task.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                {task.projects?.clients && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{task.projects.clients.name}</span>
                  </div>
                )}
                
                {task.profiles && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{task.profiles.full_name}</span>
                  </div>
                )}

                {task.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(task.deadline), "PPP")}</span>
                  </div>
                )}

                {task.projects && (
                  <div className="col-span-2 text-xs text-muted-foreground">
                    Project: {task.projects.title}
                  </div>
                )}
              </div>
            </div>

            {/* Comments Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <h3 className="font-semibold">Comments ({comments?.length || 0})</h3>
              </div>

              {/* Add Comment */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <Button 
                  onClick={handleSubmitComment} 
                  disabled={loading || !comment.trim()}
                  size="sm"
                >
                  {loading ? "Posting..." : "Post Comment"}
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-3">
                {comments?.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-lg border bg-card p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {comment.profiles?.full_name || "Unknown User"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "PPp")}
                      </span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
