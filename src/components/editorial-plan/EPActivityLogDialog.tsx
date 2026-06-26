import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";
import { Undo2, History, MessageSquare, Pencil, Check, Trash2 } from "lucide-react";

interface ActivityLog {
  id: string;
  ep_id: string;
  slide_id: string | null;
  action: string;
  actor_name: string | null;
  details: any;
  created_at: string;
}

interface Props {
  epId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  comment_added: { label: "Komentar ditambahkan", icon: MessageSquare, color: "bg-blue-100 text-blue-700" },
  comment_deleted: { label: "Komentar dihapus", icon: Trash2, color: "bg-red-100 text-red-700" },
  block_updated: { label: "Brief / caption diubah", icon: Pencil, color: "bg-amber-100 text-amber-700" },
  slide_updated: { label: "Slide diubah", icon: Pencil, color: "bg-amber-100 text-amber-700" },
  slide_approved: { label: "Slide disetujui", icon: Check, color: "bg-green-100 text-green-700" },
};

export function EPActivityLogDialog({ epId, open, onOpenChange, onChanged }: Props) {
  const queryClient = useQueryClient();

  const { data: logs, refetch, isLoading } = useQuery({
    queryKey: ["ep-activity-logs", epId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ep_activity_logs")
        .select("*")
        .eq("ep_id", epId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: open,
  });

  const undo = async (log: ActivityLog) => {
    try {
      switch (log.action) {
        case "comment_deleted": {
          const snap = log.details?.snapshot;
          if (!snap) throw new Error("Snapshot tidak tersedia");
          const { error } = await supabase.from("ep_comments").insert({
            id: snap.id,
            ep_id: snap.ep_id,
            slide_id: snap.slide_id,
            name: snap.name,
            comment: snap.comment,
            is_hidden: snap.is_hidden ?? false,
            created_at: snap.created_at,
          });
          if (error) throw error;
          break;
        }
        case "comment_added": {
          const commentId = log.details?.comment_id;
          if (!commentId) throw new Error("ID komentar tidak tersedia");
          const { error } = await supabase.from("ep_comments").delete().eq("id", commentId);
          if (error) throw error;
          break;
        }
        case "block_updated": {
          const blockId = log.details?.block_id;
          const fullBefore = log.details?.full_before;
          if (!blockId || !fullBefore) throw new Error("Snapshot tidak tersedia");
          const { error } = await supabase
            .from("slide_blocks")
            .update({ content: fullBefore })
            .eq("id", blockId);
          if (error) throw error;
          break;
        }
        case "slide_updated": {
          const field = log.details?.field;
          const before = log.details?.before ?? null;
          if (!field || !log.slide_id) throw new Error("Data tidak lengkap");
          const { error } = await supabase
            .from("editorial_slides")
            .update({ [field]: before })
            .eq("id", log.slide_id);
          if (error) throw error;
          break;
        }
        case "slide_approved": {
          if (!log.slide_id) throw new Error("Slide tidak ditemukan");
          const { error } = await supabase
            .from("editorial_slides")
            .update({ status: "proposed", approved_at: null })
            .eq("id", log.slide_id);
          if (error) throw error;
          break;
        }
        default:
          throw new Error("Aksi ini tidak bisa di-undo");
      }

      await supabase.from("ep_activity_logs").insert({
        ep_id: epId,
        slide_id: log.slide_id,
        action: "undo_" + log.action,
        actor_name: "Internal Undo",
        details: { undone_log_id: log.id, undone_details: log.details },
      });

      toast.success("Perubahan dikembalikan");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["public-slide-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["editorial-slides"] });
      queryClient.invalidateQueries({ queryKey: ["public-editorial-slides"] });
      queryClient.invalidateQueries({ queryKey: ["public-ep-comments"] });
      queryClient.invalidateQueries({ queryKey: ["ep-comments"] });
      onChanged?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Gagal undo");
    }
  };

  const renderDetails = (log: ActivityLog) => {
    switch (log.action) {
      case "comment_added":
      case "comment_deleted": {
        const text = log.details?.snapshot?.comment || log.details?.comment;
        return text ? <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">"{text}"</p> : null;
      }
      case "block_updated": {
        const before = log.details?.before || {};
        const after = log.details?.after || {};
        const changed = Object.keys(after).filter((k) => before[k] !== after[k]);
        return (
          <div className="text-xs mt-1 space-y-1">
            {changed.map((k) => (
              <div key={k} className="grid grid-cols-[80px_1fr] gap-2">
                <span className="font-medium text-muted-foreground capitalize">{k}:</span>
                <div className="space-y-0.5">
                  <div className="line-through text-muted-foreground line-clamp-1">{before[k] || "—"}</div>
                  <div className="text-foreground line-clamp-1">{after[k] || "—"}</div>
                </div>
              </div>
            ))}
          </div>
        );
      }
      case "slide_updated":
        return (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="capitalize">{log.details?.field}</span>:{" "}
            <span className="line-through">{String(log.details?.before ?? "—")}</span>
            {" → "}
            <span className="text-foreground">{String(log.details?.after ?? "—")}</span>
          </p>
        );
      default:
        return null;
    }
  };

  const canUndo = (a: string) =>
    ["comment_added", "comment_deleted", "block_updated", "slide_updated", "slide_approved"].includes(a);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            History Perubahan
          </DialogTitle>
          <DialogDescription>
            Semua aktivitas publik & internal pada editorial plan ini. Klik Undo untuk mengembalikan.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Memuat...</p>
          ) : !logs || logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Belum ada aktivitas</p>
          ) : (
            <div className="space-y-2 pb-4">
              {logs.map((log) => {
                const meta = ACTION_META[log.action] || { label: log.action, icon: History, color: "bg-muted text-foreground" };
                const Icon = meta.icon;
                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{meta.label}</span>
                        {log.actor_name && (
                          <Badge variant="outline" className="text-xs">
                            oleh {log.actor_name}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(log.created_at), "dd MMM yyyy, HH:mm")}
                        </span>
                      </div>
                      {renderDetails(log)}
                    </div>
                    {canUndo(log.action) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => undo(log)}
                        className="shrink-0"
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        Undo
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
