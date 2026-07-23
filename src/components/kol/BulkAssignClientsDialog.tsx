import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ClientAssignmentPicker } from "./ClientAssignmentPicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BulkAssignClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kolIds: string[];
  onDone?: () => void;
}

export function BulkAssignClientsDialog({ open, onOpenChange, kolIds, onDone }: BulkAssignClientsDialogProps) {
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setClientIds([]);
    setMode("add");
  };

  const handleSubmit = async () => {
    if (kolIds.length === 0) {
      toast.error("Tidak ada KOL yang dipilih");
      return;
    }
    if (clientIds.length === 0 && mode === "add") {
      toast.error("Pilih minimal 1 client");
      return;
    }

    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error("Not authenticated");

      // Fetch existing assignments for these KOLs
      const { data: existing, error: exErr } = await supabase
        .from("kol_database_clients")
        .select("id, kol_id, client_id")
        .in("kol_id", kolIds);
      if (exErr) throw exErr;

      if (mode === "replace") {
        // Delete existing assignments for selected KOLs
        const existingIds = (existing || []).map((r: any) => r.id);
        if (existingIds.length > 0) {
          const { error } = await supabase.from("kol_database_clients").delete().in("id", existingIds);
          if (error) throw error;
        }
      }

      // Compute rows to insert (skip duplicates)
      const existingSet = new Set(
        mode === "replace"
          ? []
          : (existing || []).map((r: any) => `${r.kol_id}::${r.client_id}`)
      );
      const rows: { kol_id: string; client_id: string; created_by: string }[] = [];
      for (const kid of kolIds) {
        for (const cid of clientIds) {
          const key = `${kid}::${cid}`;
          if (!existingSet.has(key)) {
            rows.push({ kol_id: kid, client_id: cid, created_by: userId });
            existingSet.add(key);
          }
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase.from("kol_database_clients").insert(rows);
        if (error) throw error;
      }

      toast.success(
        mode === "replace"
          ? `${kolIds.length} KOL diassign ulang ke ${clientIds.length} client`
          : `${rows.length} penugasan baru ditambahkan`
      );
      reset();
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Gagal assign KOL");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Assign KOL ke Client</DialogTitle>
          <DialogDescription>
            {kolIds.length} KOL terpilih. Pilih client tujuan dan mode assign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="add" id="mode-add" />
                <Label htmlFor="mode-add" className="text-sm font-normal cursor-pointer">
                  Tambahkan (gabung dengan yang sudah ada)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="replace" id="mode-replace" />
                <Label htmlFor="mode-replace" className="text-sm font-normal cursor-pointer">
                  Ganti (hapus assignment lama)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <ClientAssignmentPicker selectedIds={clientIds} onChange={setClientIds} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Terapkan ke {kolIds.length} KOL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
