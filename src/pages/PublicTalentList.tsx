import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, ExternalLink, Instagram, Phone } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const rupiah = (n: number | null) =>
  n == null ? null : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const igUrl = (raw: string | null) => {
  const v = (raw || "").trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://instagram.com/${v.replace(/^@+/, "")}`;
};

export default function PublicTalentList() {
  const { token } = useParams<{ token: string }>();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-talents", token],
    queryFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-talents?token=${token}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data");
      return json;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return <div className="flex min-h-[60dvh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-xl font-semibold">Katalog tidak tersedia</h1>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  const link = data?.link || {};
  const talents: any[] = (data?.talents || []).filter((t: any) =>
    !search.trim() ||
    (t.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.city || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.category || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}>
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{link.title || "Talent Catalogue"}</h1>
        <p className="text-sm text-muted-foreground">
          {talents.length} talent{link.category ? ` • kategori ${link.category}` : ""}
        </p>
      </header>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari talent..." className="pl-9" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {talents.map((t) => (
          <Card key={t.id} className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg" onClick={() => setSelected(t)}>
            <div className="aspect-[3/4] w-full bg-muted">
              {t.photo_url ? (
                <img src={t.photo_url} alt={t.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">{(t.name || "?").charAt(0)}</div>
              )}
            </div>
            <CardContent className="space-y-1 p-3">
              <p className="truncate font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{[t.category, t.city].filter(Boolean).join(" • ") || "Talent"}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {t.height_cm && <Badge variant="outline">{t.height_cm} cm</Badge>}
                {t.shirt_size && <Badge variant="outline">{t.shirt_size}</Badge>}
              </div>
              {link.show_rate && t.rate != null && <p className="pt-1 text-sm font-medium">{rupiah(t.rate)}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {talents.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada talent yang cocok.</p>}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              {(Array.isArray(selected.photos) && selected.photos.length > 0 ? selected.photos : selected.photo_url ? [selected.photo_url] : []).length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {(Array.isArray(selected.photos) && selected.photos.length > 0 ? selected.photos : [selected.photo_url]).map((u: string, i: number) => (
                    <a key={u + i} href={u} target="_blank" rel="noopener noreferrer" className="h-40 w-28 overflow-hidden rounded-xl border">
                      <img src={u} alt={`${selected.name} foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["Kategori", selected.category],
                  ["Kota", selected.city],
                  ["Tinggi", selected.height_cm ? `${selected.height_cm} cm` : null],
                  ["Berat", selected.weight_kg ? `${selected.weight_kg} kg` : null],
                  ["Ukuran Baju", selected.shirt_size],
                  ["Ukuran Celana", selected.pants_size],
                  ["Ukuran Sepatu", selected.shoe_size],
                  ["Lingkar Dada", selected.chest_cm ? `${selected.chest_cm} cm` : null],
                  ["Lingkar Pinggang", selected.waist_cm ? `${selected.waist_cm} cm` : null],
                  ...(link.show_rate ? [["Rate", rupiah(selected.rate)]] : []),
                ] as [string, string | null][])
                  .filter(([, v]) => !!v)
                  .map(([label, value]) => (
                    <div key={label} className="rounded-xl border p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  ))}
              </div>
              <div className="flex flex-wrap gap-3">
                {igUrl(selected.instagram) && (
                  <a href={igUrl(selected.instagram)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
                    <Instagram className="h-4 w-4" /> Instagram
                  </a>
                )}
                {selected.portfolio_url && (
                  <a href={selected.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
                    <ExternalLink className="h-4 w-4" /> Portfolio
                  </a>
                )}
                {link.show_contact && selected.phone && (
                  <a href={`https://wa.me/${String(selected.phone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
                    <Phone className="h-4 w-4" /> {selected.phone}
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
