import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Pencil, Table2, Link2, Copy } from "lucide-react";

export const EMBED_TYPES = [
  { value: "sheet", label: "Google Sheets" },
  { value: "doc", label: "Google Docs" },
  { value: "slide", label: "Google Slides" },
  { value: "form", label: "Google Form" },
  { value: "pdf", label: "PDF / Drive File" },
  { value: "link", label: "Link Biasa" },
  { value: "other", label: "Lainnya" },
];

interface Props {
  clientId: string;
  client: any;
  canEdit: boolean;
}

const emptyForm = {
  id: "" as string,
  title: "",
  description: "",
  url: "",
  embed_type: "sheet",
  sort_order: 0,
  is_active: true,
};

export function ClientEmbedSection({ clientId, client, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: embeds, isLoading } = useQuery({
    queryKey: ["client-embeds", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_embeds")
        .select("*")
        .eq("client_id", clientId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const publicUrl = client?.dashboard_slug
    ? `${window.location.origin}/files/${client.dashboard_slug}`
    : null;

  const save = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("Judul dan URL wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const payload = {
        client_id: clientId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        url: form.url.trim(),
        embed_type: form.embed_type,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (form.id) {
        const { error } = await supabase.from("client_embeds").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Embed diperbarui");
      } else {
        const { error } = await supabase
          .from("client_embeds")
          .insert({ ...payload, created_by: userRes?.user?.id ?? null });
        if (error) throw error;
        toast.success("Embed ditambahkan");
      }
      setOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["client-embeds", clientId] });
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("client_embeds").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Embed dihapus");
    queryClient.invalidateQueries({ queryKey: ["client-embeds", clientId] });
  };

  const toggleActive = async (id: string, value: boolean) => {
    const { error } = await supabase.from("client_embeds").update({ is_active: value }).eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["client-embeds", clientId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">File / Sheets</h3>
          <p className="text-sm text-muted-foreground">
            Kumpulan link & embed (Google Sheets, Docs, PDF) yang tampil di hub publik client.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setForm({ ...emptyForm });
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Tambah Embed
          </Button>
        )}
      </div>

      {publicUrl && (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{publicUrl}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Link publik dicopy");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : !embeds?.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Table2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada file/sheets yang di-embed</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {embeds.map((e: any) => (
            <div key={e.id} className="rounded-2xl border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{e.title}</p>
                  {e.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {EMBED_TYPES.find((t) => t.value === e.embed_type)?.label || e.embed_type}
                </Badge>
              </div>
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline break-all block"
              >
                {e.url}
              </a>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={e.is_active}
                    disabled={!canEdit}
                    onCheckedChange={(v) => toggleActive(e.id, v)}
                  />
                  {e.is_active ? "Publik" : "Disembunyikan"}
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setForm({
                          id: e.id,
                          title: e.title,
                          description: e.description || "",
                          url: e.url,
                          embed_type: e.embed_type,
                          sort_order: e.sort_order ?? 0,
                          is_active: e.is_active,
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Embed" : "Tambah Embed"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Judul *</Label>
              <Input
                value={form.title}
                onChange={(ev) => setForm({ ...form, title: ev.target.value })}
                placeholder="Contoh: Content Plan Agustus"
              />
            </div>
            <div>
              <Label>URL *</Label>
              <Input
                value={form.url}
                onChange={(ev) => setForm({ ...form, url: ev.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Pastikan sharing dokumen di-set "Anyone with the link" agar bisa dibaca publik.
              </p>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(ev) => setForm({ ...form, description: ev.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipe</Label>
                <Select
                  value={form.embed_type}
                  onValueChange={(v) => setForm({ ...form, embed_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMBED_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Urutan</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(ev) => setForm({ ...form, sort_order: Number(ev.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <span className="text-sm">Tampilkan di hub publik</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
