import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Trash2, EyeOff, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { MentionInput } from "@/components/tasks/MentionInput";
import { sendMentionEmail, getUserEmailById, sendEmailNotification } from "@/lib/email-notifications";

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
  epTitle?: string;
  currentSlideId?: string;
  currentSlideLabel?: string;
  onClose: () => void;
}

export function EPCommentsPanel({ epId, epTitle, currentSlideId, currentSlideLabel, onClose }: EPCommentsPanelProps) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", user.id)
        .single();
      return profile;
    },
  });

  // Fetch comments filtered by current slide
  const { data: comments, refetch } = useQuery({
    queryKey: ["ep-comments", epId, currentSlideId],
    queryFn: async () => {
      let query = supabase
        .from("ep_comments")
        .select("*")
        .eq("ep_id", epId)
        .order("created_at", { ascending: false });

      if (currentSlideId) {
        query = query.eq("slide_id", currentSlideId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Comment[];
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      if (!currentUser) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("ep_comments")
        .insert({
          ep_id: epId,
          slide_id: currentSlideId || null,
          name: currentUser.full_name,
          comment: commentText,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (_, commentText) => {
      refetch();
      setNewComment("");
      toast.success("Komentar ditambahkan");

      // Process @mentions and send emails
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      while ((match = mentionRegex.exec(commentText)) !== null) {
        const mentionedUserId = match[2];
        const mentionedName = match[1];
        
        if (mentionedUserId !== currentUser?.id) {
          const { email, name } = await getUserEmailById(mentionedUserId);
          if (email) {
            const baseUrl = window.location.origin;
            await sendEmailNotification({
              recipientEmail: email,
              recipientName: name,
              notificationType: "ep_mention",
              data: {
                title: epTitle || "Editorial Plan",
                comment_content: commentText.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1"),
                creator_name: currentUser?.full_name || "Tim",
                description: currentSlideLabel ? `Slide: ${currentSlideLabel}` : undefined,
                link: `${baseUrl}/editorial-plan`,
              },
              relatedId: epId,
            });
          }
        }
      }
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

  // Format comment text (replace mention syntax with readable names)
  const formatComment = (text: string) => {
    return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, (_, name) => `@${name}`);
  };

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">Comments</h3>
          {currentSlideId ? (
            <p className="text-xs text-muted-foreground">Slide ini</p>
          ) : (
            <p className="text-xs text-muted-foreground">Semua slide</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Add comment input */}
      {currentUser && (
        <div className="p-4 border-b space-y-2">
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            placeholder="Tulis komentar... gunakan @ untuk mention"
            rows={2}
            disabled={addCommentMutation.isPending}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!newComment.trim() || addCommentMutation.isPending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Kirim
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {comments?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {currentSlideId ? "Belum ada komentar di slide ini" : "Belum ada komentar"}
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
                <p className="text-sm whitespace-pre-wrap">{formatComment(comment.comment)}</p>
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
