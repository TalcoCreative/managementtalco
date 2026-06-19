import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Trash2, CheckSquare } from "lucide-react";

interface Props {
  taskId: string;
  readOnly?: boolean;
}

export function TaskChecklistSection({ taskId, readOnly = false }: Props) {
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["task-checklists", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_checklists")
        .select("*")
        .eq("task_id", taskId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const completed = items.filter((i: any) => i.is_completed).length;
  const total = items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["task-checklists", taskId] });

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from("task_checklists")
        .insert({ task_id: taskId, item: newItem.trim(), sort_order: total });
      if (error) throw error;
      setNewItem("");
      invalidate();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambah checklist");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      let profileId: string | null = null;
      if (session.session) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", session.session.user.id)
          .maybeSingle();
        profileId = p?.id || null;
      }
      const { error } = await supabase
        .from("task_checklists")
        .update({
          is_completed: !current,
          completed_by: !current ? profileId : null,
          completed_at: !current ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      invalidate();
    } catch (err: any) {
      toast.error(err.message || "Gagal update checklist");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("task_checklists").delete().eq("id", id);
      if (error) throw error;
      invalidate();
    } catch (err: any) {
      toast.error(err.message || "Gagal hapus item");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          <h3 className="font-semibold text-sm sm:text-base">Checklist</h3>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">
              {completed} / {total}
            </span>
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs font-medium text-muted-foreground w-10 text-right">
            {progress}%
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-1">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center gap-2 group rounded-md hover:bg-muted/50 px-2 py-1.5 -mx-2"
            >
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={() => handleToggle(item.id, item.is_completed)}
                disabled={readOnly}
              />
              <span
                className={`flex-1 text-sm ${
                  item.is_completed ? "line-through text-muted-foreground" : ""
                }`}
              >
                {item.item}
              </span>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Tambah item checklist..."
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={adding || !newItem.trim()}
            className="h-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
