import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface EventChecklistTabProps {
  eventId: string;
  canManage: boolean;
}

export function EventChecklistTab({ eventId, canManage }: EventChecklistTabProps) {
  const [newItem, setNewItem] = useState("");

  const { data: checklists, refetch } = useQuery({
    queryKey: ["event-checklists", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_checklists")
        .select(`
          *,
          completed_by_profile:profiles(full_name)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("event_checklists").insert({
        event_id: eventId,
        item: newItem,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item ditambahkan");
      setNewItem("");
      refetch();
    },
    onError: () => {
      toast.error("Gagal menambahkan item");
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.session.user.email)
        .single();

      const { error } = await supabase
        .from("event_checklists")
        .update({
          is_completed: isCompleted,
          completed_by: isCompleted ? profile?.id : null,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      toast.error("Gagal memperbarui item");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_checklists")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item dihapus");
      refetch();
    },
    onError: () => {
      toast.error("Gagal menghapus item");
    },
  });

  const completedCount = checklists?.filter(c => c.is_completed).length || 0;
  const totalCount = checklists?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          <h3 className="font-medium">Checklist Hari H</h3>
          <Badge variant="outline">
            {completedCount}/{totalCount} selesai
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {/* Add New Item */}
      {canManage && (
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Tambah item checklist..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim()) {
                addItemMutation.mutate();
              }
            }}
          />
          <Button
            onClick={() => addItemMutation.mutate()}
            disabled={!newItem.trim() || addItemMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-2">
        {checklists?.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            Belum ada item checklist
          </p>
        ) : (
          checklists?.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                item.is_completed ? "bg-muted/50" : ""
              }`}
            >
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={(checked) =>
                  toggleItemMutation.mutate({ id: item.id, isCompleted: !!checked })
                }
                disabled={!canManage}
              />
              <div className="flex-1">
                <p className={item.is_completed ? "line-through text-muted-foreground" : ""}>
                  {item.item}
                </p>
                {item.is_completed && item.completed_by_profile && (
                  <p className="text-xs text-muted-foreground">
                    Selesai oleh {item.completed_by_profile.full_name} pada{" "}
                    {format(new Date(item.completed_at!), "d MMM yyyy HH:mm", { locale: localeId })}
                  </p>
                )}
              </div>
              {canManage && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteItemMutation.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
