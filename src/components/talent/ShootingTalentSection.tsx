import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatRupiah } from "./TalentDetailDialog";
import { TALENT_CATEGORIES } from "./TalentFormDialog";

interface Props {
  shootingId: string;
  canEdit?: boolean;
}

export function ShootingTalentSection({ shootingId, canEdit = true }: Props) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [talentId, setTalentId] = useState("");
  const [role, setRole] = useState("");
  const [fee, setFee] = useState("");
  const [search, setSearch] = useState("");

  const { data: assigned, isLoading } = useQuery({
    queryKey: ["shooting-talents", shootingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_talents")
        .select("id, role, fee, talent:talents(id, name, category, phone, rate, photo_url)")
        .eq("shooting_id", shootingId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: talents } = useQuery({
    queryKey: ["talents", "picker", search],
    queryFn: async () => {
      let q = supabase.from("talents").select("id, name, category, rate").eq("status", "active").order("name").limit(100);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: adding,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!talentId) throw new Error("Pilih talent terlebih dahulu");
      const { data: session } = await supabase.auth.getSession();
      const picked = talents?.find((t: any) => t.id === talentId);
      const { error } = await supabase.from("shooting_talents").insert({
        shooting_id: shootingId,
        talent_id: talentId,
        role: role.trim() || null,
        fee: fee.trim() !== "" ? Number(fee) : picked?.rate ?? null,
        created_by: session.session?.user.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shooting-talents", shootingId] });
      setTalentId(""); setRole(""); setFee(""); setAdding(false);
      toast.success("Talent di-assign ke shooting");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shooting_talents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shooting-talents", shootingId] });
      toast.success("Talent dihapus dari shooting");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalFee = (assigned || []).reduce((sum: number, a: any) => sum + (a.fee || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Talent ({assigned?.length || 0})</span>
        {canEdit && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Assign Talent
          </Button>
        )}
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : assigned && assigned.length > 0 ? (
        <div className="space-y-2">
          {assigned.map((row: any) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border p-2">
              {row.talent?.photo_url ? (
                <img src={row.talent.photo_url} alt={row.talent?.name} className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xs">
                  {(row.talent?.name || "?").charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.talent?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.role || row.talent?.category || "Talent"} • {formatRupiah(row.fee)}
                </p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(row.id)} aria-label="Hapus talent">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <p className="text-sm font-medium">Total Talent Fee: {formatRupiah(totalFee)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Belum ada talent yang di-assign.</p>
      )}

      {canEdit && adding && (
        <div className="space-y-3 rounded-xl border p-3">
          <div>
            <Label>Cari Talent</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama talent..." />
          </div>
          <div>
            <Label>Talent</Label>
            <Select value={talentId} onValueChange={setTalentId}>
              <SelectTrigger><SelectValue placeholder="Pilih talent" /></SelectTrigger>
              <SelectContent>
                {(talents || []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.category ? ` — ${t.category}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Peran</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="cth: Talent Utama" />
            </div>
            <div>
              <Label>Fee (Rp)</Label>
              <Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="default rate talent" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Batal</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TalentShareLinkPanel() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Talent Catalogue");
  const [category, setCategory] = useState("all");
  const [showRate, setShowRate] = useState(true);
  const [showContact, setShowContact] = useState(false);

  const { data: links } = useQuery({
    queryKey: ["talent-share-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("talent_share_links").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.from("talent_share_links").insert({
        token,
        title: title.trim() || "Talent Catalogue",
        category: category === "all" ? null : category,
        show_rate: showRate,
        show_contact: showContact,
        created_by: session.session?.user.id ?? null,
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ["talent-share-links"] });
      navigator.clipboard?.writeText(`${window.location.origin}/talent-list/${token}`).catch(() => {});
      toast.success("Link publik dibuat & dicopy");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("talent_share_links").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["talent-share-links"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("talent_share_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["talent-share-links"] }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Judul Katalog</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Kategori</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {TALENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full">
            <Plus className="mr-1 h-4 w-4" /> Buat Link
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={showRate} onCheckedChange={setShowRate} id="show-rate" />
          <Label htmlFor="show-rate">Tampilkan rate</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={showContact} onCheckedChange={setShowContact} id="show-contact" />
          <Label htmlFor="show-contact">Tampilkan kontak</Label>
        </div>
      </div>

      <div className="space-y-2">
        {(links || []).length === 0 && <p className="text-sm text-muted-foreground">Belum ada link publik.</p>}
        {(links || []).map((l: any) => {
          const url = `${window.location.origin}/talent-list/${l.token}`;
          return (
            <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{l.title || "Talent Catalogue"}</p>
                <p className="truncate text-xs text-muted-foreground">{url}</p>
              </div>
              <Badge variant="outline">{l.category || "Semua"}</Badge>
              <Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? "Aktif" : "Nonaktif"}</Badge>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(url); toast.success("Link dicopy"); }}>Copy</Button>
              <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>Buka</Button>
              <Switch checked={l.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: l.id, is_active: v })} />
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(l.id)} aria-label="Hapus link">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
