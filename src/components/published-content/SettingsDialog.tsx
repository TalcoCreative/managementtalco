import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["published-content-settings"],
    queryFn: async () => (await supabase.from("published_content_settings").select("*").limit(1).maybeSingle()).data,
  });

  const [excellent, setExcellent] = useState("6");
  const [good, setGood] = useState("3");
  const [average, setAverage] = useState("1");
  const [freq, setFreq] = useState("24");

  useEffect(() => {
    if (settings) {
      setExcellent(String(settings.excellent_er));
      setGood(String(settings.good_er));
      setAverage(String(settings.average_er));
      setFreq(String(settings.refresh_frequency_hours));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        excellent_er: parseFloat(excellent),
        good_er: parseFloat(good),
        average_er: parseFloat(average),
        refresh_frequency_hours: parseInt(freq, 10),
      };
      if (settings?.id) {
        const { error } = await supabase.from("published_content_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("published_content_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["published-content-settings"] });
      toast.success("Settings disimpan");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Performance Score Thresholds</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Engagement Rate (%) cutoffs untuk Performance Score.</p>
          <div className="space-y-2"><Label>Excellent if ER ≥</Label><Input type="number" step="0.1" value={excellent} onChange={(e) => setExcellent(e.target.value)} /></div>
          <div className="space-y-2"><Label>Good if ER ≥</Label><Input type="number" step="0.1" value={good} onChange={(e) => setGood(e.target.value)} /></div>
          <div className="space-y-2"><Label>Average if ER ≥</Label><Input type="number" step="0.1" value={average} onChange={(e) => setAverage(e.target.value)} /></div>
          <div className="space-y-2"><Label>Refresh frequency (hours)</Label><Input type="number" value={freq} onChange={(e) => setFreq(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Konten dengan ER di bawah Average otomatis = Poor.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Simpan</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
