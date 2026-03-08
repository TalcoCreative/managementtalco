import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, ListChecks } from "lucide-react";

interface SubTasksSectionProps {
  taskId: string;
  readOnly?: boolean;
}

export function SubTasksSection({ taskId, readOnly = false }: SubTasksSectionProps) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const queryClient = useQueryClient();

  const { data: subTasks = [], isLoading } = useQuery({
    queryKey: ["sub-tasks", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_tasks")
        .select("*")
        .eq("task_id", taskId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const completedCount = subTasks.filter((s: any) => s.is_completed).length;
  const totalCount = subTasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sub-tasks", taskId] });
    queryClient.invalidateQueries({ queryKey: ["active-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["completed-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("sub_tasks").insert({
        task_id: taskId,
        title: newTitle.trim(),
        sort_order: totalCount,
      });
      if (error) throw error;
      setNewTitle("");
      invalidate();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambah sub-task");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (subTaskId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("sub_tasks")
        .update({ is_completed: !currentState })
        .eq("id", subTaskId);
      if (error) throw error;
      invalidate();
    } catch (err: any) {
      toast.error(err.message || "Gagal update sub-task");
    }
  };

  const handleDelete = async (subTaskId: string) => {
    try {
      const { error } = await supabase
        .from("sub_tasks")
        .delete()
        .eq("id", subTaskId);
      if (error) throw error;
      invalidate();
    } catch (err: any) {
      toast.error(err.message || "Gagal hapus sub-task");
    }
  };

  const handleSaveEdit = async (subTaskId: string) => {
    if (!editTitle.trim()) return;
    try {
      const { error } = await supabase
        .from("sub_tasks")
        .update({ title: editTitle.trim() })
        .eq("id", subTaskId);
      if (error) throw error;
      setEditingId(null);
      setEditTitle("");
      invalidate();
    } catch (err: any) {
      toast.error(err.message || "Gagal update sub-task");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          <h3 className="font-semibold text-sm sm:text-base">Sub-Tasks</h3>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedCount} / {totalCount}
            </span>
          )}
        </div>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs font-medium text-muted-foreground w-10 text-right">{progress}%</span>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-1">
          {subTasks.map((sub: any) => (
            <div
              key={sub.id}
              className="flex items-center gap-2 group rounded-md hover:bg-muted/50 px-2 py-1.5 -mx-2"
            >
              <Checkbox
                checked={sub.is_completed}
                onCheckedChange={() => handleToggle(sub.id, sub.is_completed)}
                disabled={readOnly}
              />
              {editingId === sub.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(sub.id);
                      if (e.key === "Escape") { setEditingId(null); setEditTitle(""); }
                    }}
                  />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSaveEdit(sub.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingId(null); setEditTitle(""); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${sub.is_completed ? "line-through text-muted-foreground" : ""}`}>
                    {sub.title}
                  </span>
                  {!readOnly && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => { setEditingId(sub.id); setEditTitle(sub.title); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleDelete(sub.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tambah sub-task..."
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="h-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Lightweight indicator for task cards/tables
export function SubTaskIndicator({ taskId }: { taskId: string }) {
  const { data: subTasks = [] } = useQuery({
    queryKey: ["sub-tasks", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_tasks")
        .select("is_completed")
        .eq("task_id", taskId);
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  if (subTasks.length === 0) return null;

  const completed = subTasks.filter((s: any) => s.is_completed).length;
  const total = subTasks.length;
  const progress = Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-2 w-full">
      <ListChecks className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <Progress value={progress} className="flex-1 h-1.5" />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}
