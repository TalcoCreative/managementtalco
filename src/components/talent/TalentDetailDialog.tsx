import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ExternalLink, Instagram, Pencil, Phone } from "lucide-react";
import type { TalentRecord } from "./TalentFormDialog";

export const formatRupiah = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export const instagramUrl = (raw: string | null | undefined) => {
  const val = (raw || "").trim();
  if (!val) return null;
  if (/^https?:\/\//i.test(val)) return val;
  return `https://instagram.com/${val.replace(/^@+/, "")}`;
};

interface Props {
  talent: TalentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (talent: TalentRecord) => void;
}

export function TalentDetailDialog({ talent, open, onOpenChange, onEdit }: Props) {
  const { data: shootings } = useQuery({
    queryKey: ["talent-detail", "shootings", talent?.id],
    queryFn: async () => {
      if (!talent) return [];
      const { data, error } = await supabase
        .from("shooting_talents")
        .select("id, role, fee, shooting:shooting_schedules(id, title, scheduled_date, status, location)")
        .eq("talent_id", talent.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!talent && open,
  });

  if (!talent) return null;

  const photos: string[] = Array.isArray(talent.photos) ? (talent.photos as string[]) : [];
  const gallery = talent.photo_url && !photos.includes(talent.photo_url) ? [talent.photo_url, ...photos] : photos;
  const ig = instagramUrl(talent.instagram);

  const rows: [string, string][] = [
    ["Kategori", talent.category || "-"],
    ["Kota", talent.city || "-"],
    ["Gender", talent.gender === "male" ? "Pria" : talent.gender === "female" ? "Wanita" : talent.gender || "-"],
    ["Tanggal Lahir", talent.birth_date ? format(new Date(talent.birth_date), "dd MMM yyyy") : "-"],
    ["Tinggi", talent.height_cm ? `${talent.height_cm} cm` : "-"],
    ["Berat", talent.weight_kg ? `${talent.weight_kg} kg` : "-"],
    ["Ukuran Baju", talent.shirt_size || "-"],
    ["Ukuran Celana", talent.pants_size || "-"],
    ["Ukuran Sepatu", talent.shoe_size || "-"],
    ["Lingkar Dada", talent.chest_cm ? `${talent.chest_cm} cm` : "-"],
    ["Lingkar Pinggang", talent.waist_cm ? `${talent.waist_cm} cm` : "-"],
    ["Rate", formatRupiah(talent.rate)],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl">{talent.name}</DialogTitle>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(talent)}>
                <Pencil className="mr-1 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={talent.status === "active" ? "default" : "secondary"}>{talent.status}</Badge>
            {talent.source === "form" && <Badge variant="outline">Dari Form Publik</Badge>}
            {talent.phone && (
              <a href={`https://wa.me/${talent.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
                <Phone className="h-3.5 w-3.5" /> {talent.phone}
              </a>
            )}
            {ig && (
              <a href={ig} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
                <Instagram className="h-3.5 w-3.5" /> Instagram
              </a>
            )}
            {talent.portfolio_url && (
              <a href={talent.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
                <ExternalLink className="h-3.5 w-3.5" /> Portfolio
              </a>
            )}
          </div>

          {gallery.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {gallery.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="h-32 w-24 overflow-hidden rounded-xl border">
                  <img src={url} alt={`${talent.name} foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>

          {talent.notes && (
            <div className="rounded-xl border p-3">
              <p className="mb-1 text-xs text-muted-foreground">Catatan</p>
              <p className="whitespace-pre-wrap text-sm">{talent.notes}</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Riwayat Shooting ({shootings?.length || 0})</h3>
            {!shootings || shootings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum pernah di-assign ke shooting.</p>
            ) : (
              <div className="space-y-2">
                {shootings.map((row: any) => (
                  <div key={row.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <div>
                      <p className="font-medium">{row.shooting?.title || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.shooting?.scheduled_date ? format(new Date(row.shooting.scheduled_date), "dd MMM yyyy") : "-"}
                        {row.shooting?.location ? ` • ${row.shooting.location}` : ""}
                        {row.role ? ` • ${row.role}` : ""}
                      </p>
                    </div>
                    <span className="text-xs">{formatRupiah(row.fee)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
