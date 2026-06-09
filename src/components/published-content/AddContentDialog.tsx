import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("threads.net")) return "threads";
  return "website";
}

const CONTENT_TYPES = [
  "Reel", "Feed Post", "Story", "Carousel", "Video", "Short",
  "Live", "Article", "Blog Post", "Landing Page", "Other",
];

export function AddContentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", url: "", content_type: "Reel", publish_date: "",
    client_id: "", campaign_id: "", caption_notes: "",
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-for-content"],
    queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data || [],
  });
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-content"],
    queryFn: async () => {
      const { data } = await supabase.from("kol_campaigns").select("id,campaign_name,kol:kol_database(name)").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.url.trim()) throw new Error("URL wajib diisi");
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      const platform = detectPlatform(form.url);
      const { data, error } = await supabase.from("published_contents").insert({
        title: form.title || null,
        content_url: form.url.trim(),
        platform,
        content_type: form.content_type,
        publish_date: form.publish_date || null,
        client_id: form.client_id || null,
        campaign_id: form.campaign_id || null,
        caption_notes: form.caption_notes || null,
        creator_user_id: userId,
        created_by: userId,
        scrape_status: "pending",
      }).select().single();
      if (error) throw error;
      // Trigger scrape (fire-and-forget but await once to surface errors)
      await supabase.functions.invoke("scrape-content", { body: { content_id: data.id } });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-published-contents"] });
      toast.success("Content ditambahkan & metrik di-scrape");
      onOpenChange(false);
      setForm({ title: "", url: "", content_type: "Reel", publish_date: "", client_id: "", campaign_id: "", caption_notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Register Published Content</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Content URL *</Label>
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Optional title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Publish Date</Label>
              <Input type="date" value={form.publish_date} onChange={(e) => setForm({ ...form, publish_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Client</Label>
            <SearchableSelect
              options={(clients || []).map((c: any) => ({ value: c.id, label: c.name }))}
              value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}
              placeholder="Pilih client (opsional)" searchPlaceholder="Cari client..."
            />
          </div>
          <div className="space-y-2">
            <Label>Campaign</Label>
            <SearchableSelect
              options={(campaigns || []).map((c: any) => ({ value: c.id, label: `${c.campaign_name} (${c.kol?.name || "-"})` }))}
              value={form.campaign_id} onValueChange={(v) => setForm({ ...form, campaign_id: v })}
              placeholder="Pilih campaign (opsional)" searchPlaceholder="Cari campaign..."
            />
          </div>
          <div className="space-y-2">
            <Label>Caption Notes</Label>
            <Textarea rows={2} value={form.caption_notes} onChange={(e) => setForm({ ...form, caption_notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan & Scrape
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
