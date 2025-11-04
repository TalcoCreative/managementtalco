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

interface ProjectDetailDialogProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailDialog({ projectId, open, onOpenChange }: ProjectDetailDialogProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
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

  const { data: comments } = useQuery({
    queryKey: ["project-comments", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles(full_name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!projectId,
  });

  const handleSubmitComment = async () => {
    if (!comment.trim() || !projectId) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("comments").insert({
        content: comment,
        project_id: projectId,
        author_id: session.session.user.id,
      });

      if (error) throw error;

      toast.success("Comment added!");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] });
    } catch (error: any) {
      toast.error(error.message || "Failed to add comment");
    } finally {
      setLoading(false);
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

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-2xl">{project.title}</DialogTitle>
            <Badge className={getStatusColor(project.status)}>
              {project.status?.replace("_", " ")}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
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
