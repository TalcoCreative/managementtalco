import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, ExternalLink, Clock, CheckCircle2, AlertCircle, Users, Wallet, Instagram, Youtube } from "lucide-react";

const statusLabels: Record<string, string> = {
  contacted: "Baru Dikontak",
  negotiation: "Nego",
  deal: "Deal",
  production: "Produksi",
  visit: "Visit",
  ready_to_post: "Siap Posting",
  posted: "Posted",
  completed: "Selesai",
};

const statusColors: Record<string, string> = {
  contacted: "bg-gray-500",
  negotiation: "bg-yellow-500",
  deal: "bg-blue-500",
  production: "bg-purple-500",
  visit: "bg-cyan-500",
  ready_to_post: "bg-orange-500",
  posted: "bg-green-500",
  completed: "bg-emerald-600",
};

const platformLabels: Record<string, string> = {
  ig_story: "IG Story",
  ig_feed: "IG Feed",
  ig_reels: "IG Reels",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const tierLabels: Record<string, string> = {
  nano: "Nano",
  micro: "Micro",
  macro: "Macro",
  mega: "Mega",
};

interface KolItem {
  id: string;
  name: string;
  username: string;
  category: string;
  industry: string | null;
  followers: Record<string, number | null>;
  links: Record<string, string | null>;
}

interface KolCampaignItem {
  id: string;
  kol_name: string;
  kol_username: string;
  campaign_name: string;
  platform: string;
  status: string;
  is_posted: boolean;
  post_link: string | null;
  budget: number | null;
}

const formatFollowers = (n: number | null | undefined) => {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

const formatRupiah = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
};

export default function PublicKolCampaign() {
  const { clientSlug } = useParams<{ clientSlug: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-kol-campaigns", clientSlug],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${baseUrl}/functions/v1/public-kol-campaigns?slug=${encodeURIComponent(clientSlug || "")}`,
        { headers: { "Content-Type": "application/json", apikey: apiKey } }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!clientSlug,
  });

  if (isLoading) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Memuat KOL...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Gagal memuat data KOL</p>
        </div>
      </div>
    );
  }

  const kols: KolItem[] = data.kols || [];
  const campaigns: KolCampaignItem[] = data.campaigns || [];

  // Map kol_id (by name+username) → list of campaigns for quick lookup
  const campaignsByKol = new Map<string, KolCampaignItem[]>();
  campaigns.forEach((c) => {
    const key = `${c.kol_name}::${c.kol_username}`;
    if (!campaignsByKol.has(key)) campaignsByKol.set(key, []);
    campaignsByKol.get(key)!.push(c);
  });

  return (
    <div className="min-h-[100dvh] hub-gradient">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4" />
        <div className="relative container mx-auto px-4 pt-8 pb-4 sm:pt-12 sm:pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(28,78%,52%)] to-[hsl(38,82%,52%)] flex items-center justify-center shadow-lg">
              <Megaphone className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">KOL & Campaign</h1>
              <p className="text-sm text-muted-foreground">{data.clientName}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-10 space-y-8">
        {/* ===== KOL Listing ===== */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              KOL Listing ({kols.length})
            </h2>
          </div>

          {kols.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">Belum ada KOL yang ter-list untuk Anda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kols.map((k) => {
                const ig = formatFollowers(k.followers.instagram);
                const tt = formatFollowers(k.followers.tiktok);
                const yt = formatFollowers(k.followers.youtube);
                const kolCamps = campaignsByKol.get(`${k.name}::${k.username}`) || [];
                return (
                  <Card key={k.id} className="hub-card overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{k.name}</p>
                          <p className="text-xs text-muted-foreground truncate">@{k.username}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {tierLabels[k.category] || k.category}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {ig && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-700 dark:text-pink-300">
                            <Instagram className="h-3 w-3" /> {ig}
                          </span>
                        )}
                        {tt && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/10">
                            TT {tt}
                          </span>
                        )}
                        {yt && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-300">
                            <Youtube className="h-3 w-3" /> {yt}
                          </span>
                        )}
                        {k.industry && (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {k.industry}
                          </span>
                        )}
                      </div>

                      {kolCamps.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1.5">
                          {kolCamps.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Badge className={`${statusColors[c.status] || "bg-gray-500"} text-white text-[9px] px-1.5 py-0`}>
                                  {statusLabels[c.status] || c.status}
                                </Badge>
                                <span className="text-muted-foreground truncate">
                                  {platformLabels[c.platform] || c.platform}
                                </span>
                              </div>
                              {c.post_link && (
                                <a
                                  href={c.post_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline shrink-0"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ===== Active Campaigns with budget ===== */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Campaign Berjalan ({campaigns.length})
            </h2>
          </div>

          {campaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">Belum ada campaign yang berjalan.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Card key={c.id} className="hub-card overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{c.kol_name}</p>
                        <p className="text-xs text-muted-foreground">@{c.kol_username}</p>
                        <p className="text-xs text-muted-foreground mt-1">{c.campaign_name}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {platformLabels[c.platform] || c.platform}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Badge className={`${statusColors[c.status] || "bg-gray-500"} text-white text-[10px]`}>
                        {statusLabels[c.status] || c.status}
                      </Badge>

                      {c.is_posted ? (
                        <div className="flex items-center gap-1 text-green-600 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Posted</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Belum Post</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-xs text-foreground/80 ml-auto">
                        <Wallet className="h-3.5 w-3.5" />
                        <span className="font-medium">{formatRupiah(c.budget)}</span>
                      </div>

                      {c.post_link && (
                        <a
                          href={c.post_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary text-xs hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Lihat Post
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
