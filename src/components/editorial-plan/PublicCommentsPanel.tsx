import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ensureActorName, getActorName, setActorName } from "@/lib/ep-actor";

interface Comment {
  id: string;
  ep_id: string;
  slide_id: string | null;
  name: string;
  comment: string;
  is_hidden: boolean;
  created_at: string;
}

interface PublicCommentsPanelProps {
  epId: string;
  currentSlideId?: string;
  onClose: () => void;
}

export function PublicCommentsPanel({ epId, currentSlideId, onClose }: PublicCommentsPanelProps) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    const saved = getActorName(epId);
    if (saved) setName(saved);
  }, [epId]);

  // Fetch comments filtered by current slide (only non-hidden)
  const { data: comments, refetch } = useQuery({
    queryKey: ["public-ep-comments", epId, currentSlideId],
    queryFn: async () => {
      let query = supabase
        .from("ep_comments")
        .select("*")
        .eq("ep_id", epId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

      if (currentSlideId) {
        query = query.eq("slide_id", currentSlideId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Comment[];
    },
  });

  // Add comment mutation - always tied to current slide
  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !comment.trim()) {
        throw new Error("Name and comment are required");
      }
      setActorName(epId, name.trim());

      const { data, error } = await supabase
        .from("ep_comments")
        .insert({
          ep_id: epId,
          slide_id: currentSlideId || null,
          name: name.trim(),
          comment: comment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("ep_activity_logs").insert({
        ep_id: epId,
        slide_id: currentSlideId || null,
        action: "comment_added",
        actor_name: name.trim(),
        details: { comment_id: data.id, comment: comment.trim() },
      });
    },
    onSuccess: () => {
      setComment("");
      refetch();
      toast.success("Comment added!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add comment");
    },
  });

  // Delete comment mutation (public). Captures snapshot for undo and logs the actor.
  const deleteCommentMutation = useMutation({
    mutationFn: async (c: Comment) => {
      const actor = ensureActorName(epId, "Masukkan nama Anda untuk menghapus komentar:");
      if (!actor) throw new Error("Nama wajib diisi");

      const { error } = await supabase.from("ep_comments").delete().eq("id", c.id);
      if (error) throw error;

      await supabase.from("ep_activity_logs").insert({
        ep_id: epId,
        slide_id: c.slide_id,
        action: "comment_deleted",
        actor_name: actor,
        details: {
          comment_id: c.id,
          snapshot: {
            id: c.id,
            ep_id: c.ep_id,
            slide_id: c.slide_id,
            name: c.name,
            comment: c.comment,
            is_hidden: c.is_hidden,
            created_at: c.created_at,
          },
        },
      });
    },
    onSuccess: () => {
      refetch();
      toast.success("Komentar dihapus");
    },
    onError: (e: any) => toast.error(e.message || "Gagal menghapus komentar"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCommentMutation.mutate();
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">Comments</h3>
          {currentSlideId ? (
            <p className="text-xs text-muted-foreground">Slide ini</p>
          ) : (
            <p className="text-xs text-muted-foreground">Pilih slide untuk komentar</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Comment Form - only show when on a slide */}
      {currentSlideId && (
        <form onSubmit={handleSubmit} className="p-4 border-b space-y-3">
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder="Write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim() || !comment.trim() || addCommentMutation.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            {addCommentMutation.isPending ? "Sending..." : "Send Comment"}
          </Button>
        </form>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {!currentSlideId ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Pilih slide terlebih dahulu untuk melihat dan menambah komentar
            </p>
          ) : comments?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Belum ada komentar di slide ini
            </p>
          ) : (
            comments?.map((c) => (
              <div key={c.id} className="p-3 rounded-lg bg-muted">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), "dd MMM, HH:mm")}
                  </span>
                </div>
                <p className="text-sm">{c.comment}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
