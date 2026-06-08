import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slideId: string;
  currentEpId: string;
  onMoved?: (targetEpId: string) => void;
}

export function MoveSlideDialog({ open, onOpenChange, slideId, currentEpId, onMoved }: Props) {
  const [targetEpId, setTargetEpId] = useState<string>("");
  const [moving, setMoving] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["editorial-plans-move-target"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editorial_plans")
        .select("id, title, period, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const options =
    plans
      ?.filter((p: any) => p.id !== currentEpId)
      .map((p: any) => ({
        value: p.id,
        label: `${p.clients?.name ? p.clients.name + " — " : ""}${p.title}${p.period ? ` (${p.period})` : ""}`,
      })) || [];

  const handleMove = async () => {
    if (!targetEpId) {
      toast.error("Pilih Editorial Plan tujuan");
      return;
    }
    setMoving(true);
    try {
      // Compute next slide_order in the target EP
      const { data: maxRow, error: maxErr } = await supabase
        .from("editorial_slides")
        .select("slide_order")
        .eq("ep_id", targetEpId)
        .order("slide_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxErr) throw maxErr;
      const nextOrder = (maxRow?.slide_order ?? -1) + 1;

      const { error } = await supabase
        .from("editorial_slides")
        .update({ ep_id: targetEpId, slide_order: nextOrder })
        .eq("id", slideId);
      if (error) throw error;

      toast.success("Slide dipindahkan");
      onOpenChange(false);
      onMoved?.(targetEpId);
    } catch (e: any) {
      console.error(e);
      toast.error(`Gagal memindahkan: ${e?.message || "unknown"}`);
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pindahkan Slide</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Editorial Plan tujuan</Label>
          <SearchableSelect
            value={targetEpId}
            onValueChange={setTargetEpId}
            options={options}
            placeholder="Pilih EP tujuan..."
            searchPlaceholder="Cari EP..."
          />
          <p className="text-xs text-muted-foreground">
            Slide akan dipindahkan beserta semua konten (gambar, caption, status, komentar).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleMove} disabled={moving || !targetEpId}>
            {moving ? "Memindahkan..." : "Pindahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
