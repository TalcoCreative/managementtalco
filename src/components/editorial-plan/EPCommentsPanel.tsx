import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Trash2, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Comment {
  id: string;
  ep_id: string;
  slide_id: string | null;
  name: string;
  comment: string;
  is_hidden: boolean;
  created_at: string;
}

interface EPCommentsPanelProps {
  epId: string;
  onClose: () => void;
}

export function EPCommentsPanel({ epId, onClose }: EPCommentsPanelProps) {
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: comments, refetch } = useQuery({
    queryKey: ["ep-comments", epId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ep_comments")
        .select("*")
        .eq("ep_id", epId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Comment[];
    },
  });

  // Hide comment mutation
  const hideCommentMutation = useMutation({
    mutationFn: async ({ commentId, isHidden }: { commentId: string; isHidden: boolean }) => {
      const { error } = await supabase
        .from("ep_comments")
        .update({ is_hidden: isHidden })
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast.success("Comment updated");
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("ep_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast.success("Comment deleted");
    },
  });

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Comments</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {comments?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No comments yet
            </p>
          ) : (
            comments?.map((comment) => (
              <div
                key={comment.id}
                className={`p-3 rounded-lg ${
                  comment.is_hidden ? "bg-muted/50 opacity-60" : "bg-muted"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-medium text-sm">{comment.name}</span>
                    {comment.is_hidden && (
                      <span className="text-xs text-muted-foreground ml-2">(hidden)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => hideCommentMutation.mutate({
                        commentId: comment.id,
                        isHidden: !comment.is_hidden,
                      })}
                    >
                      <EyeOff className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Delete this comment?")) {
                          deleteCommentMutation.mutate(comment.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm">{comment.comment}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(comment.created_at), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
