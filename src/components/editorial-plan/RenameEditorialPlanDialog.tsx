import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: { id: string; title: string; period: string | null } | null;
  onSuccess?: () => void;
}

export function RenameEditorialPlanDialog({ open, onOpenChange, plan, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setTitle(plan.title || "");
      setPeriod(plan.period || "");
    }
  }, [plan]);

  const handleSave = async () => {
    if (!plan) return;
    if (!title.trim()) {
      toast.error("Judul tidak boleh kosong");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("editorial_plans")
      .update({ title: title.trim(), period: period.trim() || null })
      .eq("id", plan.id);
    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan");
      return;
    }
    toast.success("Editorial Plan diperbarui");
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Editorial Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Judul</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul EP..." />
          </div>
          <div className="space-y-1.5">
            <Label>Periode (opsional)</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="cth: Juni 2026" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
