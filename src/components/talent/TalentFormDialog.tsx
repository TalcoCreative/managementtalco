import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const TALENT_CATEGORIES = [
  "Model",
  "Talent Iklan",
  "Host / MC",
  "Dancer",
  "Musician",
  "Voice Over",
  "Extras",
  "Other",
];

export const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export interface TalentRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  gender: string | null;
  birth_date: string | null;
  instagram: string | null;
  portfolio_url: string | null;
  photo_url: string | null;
  photos: any;
  height_cm: number | null;
  weight_kg: number | null;
  shoe_size: string | null;
  shirt_size: string | null;
  pants_size: string | null;
  chest_cm: number | null;
  waist_cm: number | null;
  category: string | null;
  rate: number | null;
  status: string;
  notes: string | null;
  source: string;
}

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  city: "",
  gender: "",
  birth_date: "",
  instagram: "",
  portfolio_url: "",
  height_cm: "",
  weight_kg: "",
  shoe_size: "",
  shirt_size: "",
  pants_size: "",
  chest_cm: "",
  waist_cm: "",
  category: "",
  rate: "",
  status: "active",
  notes: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  talent?: TalentRecord | null;
}

export function TalentFormDialog({ open, onOpenChange, talent }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (talent) {
      setForm({
        name: talent.name || "",
        phone: talent.phone || "",
        email: talent.email || "",
        city: talent.city || "",
        gender: talent.gender || "",
        birth_date: talent.birth_date || "",
        instagram: talent.instagram || "",
        portfolio_url: talent.portfolio_url || "",
        height_cm: talent.height_cm != null ? String(talent.height_cm) : "",
        weight_kg: talent.weight_kg != null ? String(talent.weight_kg) : "",
        shoe_size: talent.shoe_size || "",
        shirt_size: talent.shirt_size || "",
        pants_size: talent.pants_size || "",
        chest_cm: talent.chest_cm != null ? String(talent.chest_cm) : "",
        waist_cm: talent.waist_cm != null ? String(talent.waist_cm) : "",
        category: talent.category || "",
        rate: talent.rate != null ? String(talent.rate) : "",
        status: talent.status || "active",
        notes: talent.notes || "",
      });
      const list = Array.isArray(talent.photos) ? (talent.photos as string[]) : [];
      setPhotos(talent.photo_url && !list.includes(talent.photo_url) ? [talent.photo_url, ...list] : list);
    } else {
      setForm({ ...emptyForm });
      setPhotos([]);
    }
  }, [open, talent]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `talents/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("form-uploads").upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("form-uploads").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setPhotos((prev) => [...prev, ...urls]);
    } catch (e: any) {
      toast.error("Gagal upload foto: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nama wajib diisi");
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id ?? null;

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        instagram: form.instagram.trim() || null,
        portfolio_url: form.portfolio_url.trim() || null,
        photo_url: photos[0] || null,
        photos,
        height_cm: num(form.height_cm),
        weight_kg: num(form.weight_kg),
        shoe_size: form.shoe_size.trim() || null,
        shirt_size: form.shirt_size || null,
        pants_size: form.pants_size.trim() || null,
        chest_cm: num(form.chest_cm),
        waist_cm: num(form.waist_cm),
        category: form.category || null,
        rate: num(form.rate),
        status: form.status,
        notes: form.notes.trim() || null,
        updated_by: uid,
      };

      if (talent) {
        const { error } = await supabase.from("talents").update(payload).eq("id", talent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("talents").insert({ ...payload, created_by: uid, source: "manual" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["talents"] });
      queryClient.invalidateQueries({ queryKey: ["talent-detail"] });
      toast.success(talent ? "Talent diperbarui" : "Talent ditambahkan");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{talent ? "Edit Talent" : "Tambah Talent"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nama Lengkap *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nama talent" />
            </div>
            <div>
              <Label>Nomor HP</Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="08xxxx" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="opsional" />
            </div>
            <div>
              <Label>Kota / Domisili</Label>
              <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm((p) => ({ ...p, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Pria</SelectItem>
                  <SelectItem value="female">Wanita</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tanggal Lahir</Label>
              <Input type="date" value={form.birth_date} onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))} />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input value={form.instagram} onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))} placeholder="@username" />
            </div>
            <div className="sm:col-span-2">
              <Label>Link Portfolio</Label>
              <Input value={form.portfolio_url} onChange={(e) => setForm((p) => ({ ...p, portfolio_url: e.target.value }))} placeholder="https://" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Foto Talent</Label>
            <div className="flex flex-wrap gap-3">
              {photos.map((url, idx) => (
                <div key={url} className="relative h-24 w-20 overflow-hidden rounded-xl border">
                  <img src={url} alt={`Foto talent ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((u) => u !== url))}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-1"
                    aria-label="Hapus foto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Foto pertama dipakai sebagai foto utama.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Tinggi (cm)</Label>
              <Input type="number" value={form.height_cm} onChange={(e) => setForm((p) => ({ ...p, height_cm: e.target.value }))} />
            </div>
            <div>
              <Label>Berat (kg)</Label>
              <Input type="number" value={form.weight_kg} onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))} />
            </div>
            <div>
              <Label>Ukuran Sepatu</Label>
              <Input value={form.shoe_size} onChange={(e) => setForm((p) => ({ ...p, shoe_size: e.target.value }))} placeholder="42" />
            </div>
            <div>
              <Label>Ukuran Baju</Label>
              <Select value={form.shirt_size} onValueChange={(v) => setForm((p) => ({ ...p, shirt_size: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>
                  {SHIRT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ukuran Celana</Label>
              <Input value={form.pants_size} onChange={(e) => setForm((p) => ({ ...p, pants_size: e.target.value }))} placeholder="30" />
            </div>
            <div>
              <Label>Lingkar Dada (cm)</Label>
              <Input type="number" value={form.chest_cm} onChange={(e) => setForm((p) => ({ ...p, chest_cm: e.target.value }))} />
            </div>
            <div>
              <Label>Lingkar Pinggang (cm)</Label>
              <Input type="number" value={form.waist_cm} onChange={(e) => setForm((p) => ({ ...p, waist_cm: e.target.value }))} />
            </div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>
                  {TALENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Harga / Rate (Rp)</Label>
              <Input type="number" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} placeholder="per hari / job" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Catatan</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
