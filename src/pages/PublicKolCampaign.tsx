import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Megaphone,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Wallet,
  Instagram,
  Youtube,
  Calendar,
  CalendarIcon,
  TrendingUp,
  Tag,
  X,
} from "lucide-react";

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
  instagram: "Instagram",
  twitter: "Twitter (X)",
  threads: "Threads",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  other: "Other",
};

const contentTypeLabels: Record<string, string> = {
  story: "Story",
  feed: "Feed",
  reels: "Reels",
  video: "Video",
  short: "Short",
  live: "Live",
  collab: "Collab",
  tweet: "Tweet",
  thread: "Thread",
  post: "Post",
};

const tierLabels: Record<string, string> = {
  nano: "Nano",
  micro: "Micro",
  macro: "Macro",
  mega: "Mega",
};

interface RateCard {
  platform: string;
  content_type: string;
  label?: string;
  rate: number | null;
}

interface KolItem {
  id: string;
  name: string;
  username: string;
  category: string;
  industry: string | null;
  followers: Record<string, number | null>;
  links: Record<string, string | null>;
  rate_cards: RateCard[];
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
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
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

const formatDate = (d: string | null | undefined) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return null;
  }
};

const rateLabel = (r: RateCard) => {
  if (r.label) return r.label;
  const p = platformLabels[r.platform] || r.platform;
  const c = contentTypeLabels[r.content_type] || r.content_type;
  return `${p} ${c}`;
};

export default function PublicKolCampaign() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

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

  const allCampaigns: KolCampaignItem[] = data?.campaigns || [];

  // Filter campaigns by date range (uses posted_at, paid_at, or created_at)
  const campaigns = useMemo(() => {
    if (!dateRange?.from) return allCampaigns;
    const fromTs = new Date(new Date(dateRange.from).setHours(0, 0, 0, 0)).getTime();
    const toTs = dateRange.to
      ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).getTime()
      : new Date(new Date(dateRange.from).setHours(23, 59, 59, 999)).getTime();
    return allCampaigns.filter((c) => {
      const candidates = [c.posted_at, c.paid_at, c.created_at].filter(Boolean) as string[];
      return candidates.some((d) => {
        const ts = new Date(d).getTime();
        return ts >= fromTs && ts <= toTs;
      });
    });
  }, [allCampaigns, dateRange]);

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

  // Summary stats
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
  const paidSpend = campaigns.filter((c) => c.is_paid).reduce((sum, c) => sum + (c.budget || 0), 0);
  const postedCount = campaigns.filter((c) => c.is_posted).length;
  const ongoingCount = campaigns.filter((c) => !["posted", "completed"].includes(c.status)).length;

  // Map kol by name+username for campaigns linkage
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(28,78%,52%)] to-[hsl(38,82%,52%)] flex items-center justify-center shadow-lg">
                <Megaphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">KOL & Campaign</h1>
                <p className="text-sm text-muted-foreground">{data.clientName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd MMM", { locale: localeId })} —{" "}
                          {format(dateRange.to, "dd MMM yyyy", { locale: localeId })}
                        </>
                      ) : (
                        format(dateRange.from, "dd MMM yyyy", { locale: localeId })
                      )
                    ) : (
                      "Filter Tanggal"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
                  <CalendarUI
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {dateRange?.from && (
                <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-10 space-y-8">
        {/* ===== Summary KPIs ===== */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="hub-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Total KOL
              </div>
              <p className="text-2xl font-bold mt-1">{kols.length}</p>
            </CardContent>
          </Card>
          <Card className="hub-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Megaphone className="h-3.5 w-3.5" /> Campaign
              </div>
              <p className="text-2xl font-bold mt-1">{campaigns.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {postedCount} posted · {ongoingCount} ongoing
              </p>
            </CardContent>
          </Card>
          <Card className="hub-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" /> Total Budget
              </div>
              <p className="text-xl font-bold mt-1 truncate">{formatRupiah(totalSpend)}</p>
            </CardContent>
          </Card>
          <Card className="hub-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> Sudah Dibayar
              </div>
              <p className="text-xl font-bold mt-1 truncate text-green-600 dark:text-green-400">
                {formatRupiah(paidSpend)}
              </p>
            </CardContent>
          </Card>
        </section>

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
                const rates = (k.rate_cards || []).filter((r) => r && (r.rate || r.rate === 0));
                return (
                  <Card key={k.id} className="hub-card overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <a
                          href={k.links.instagram || k.links.tiktok || k.links.youtube || k.links.twitter || k.links.linkedin || k.links.threads || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 group"
                          onClick={(e) => {
                            const href = (e.currentTarget as HTMLAnchorElement).getAttribute("href");
                            if (!href || href === "#") e.preventDefault();
                          }}
                        >
                          <p className="font-semibold truncate group-hover:text-primary transition-colors">
                            {k.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate group-hover:underline">@{k.username}</p>
                        </a>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {tierLabels[k.category] || k.category}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {ig && (
                          k.links.instagram ? (
                            <a
                              href={k.links.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-700 dark:text-pink-300 hover:bg-pink-500/20 transition-colors"
                            >
                              <Instagram className="h-3 w-3" /> {ig}
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-700 dark:text-pink-300">
                              <Instagram className="h-3 w-3" /> {ig}
                            </span>
                          )
                        )}
                        {tt && (
                          k.links.tiktok ? (
                            <a
                              href={k.links.tiktok}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
                            >
                              TT {tt}
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/10">
                              TT {tt}
                            </span>
                          )
                        )}
                        {yt && (
                          k.links.youtube ? (
                            <a
                              href={k.links.youtube}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20 transition-colors"
                            >
                              <Youtube className="h-3 w-3" /> {yt}
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-300">
                              <Youtube className="h-3 w-3" /> {yt}
                            </span>
                          )
                        )}
                        {k.links.twitter && (
                          <a
                            href={k.links.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" /> Twitter
                          </a>
                        )}
                        {k.links.linkedin && (
                          <a
                            href={k.links.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" /> LinkedIn
                          </a>
                        )}
                        {k.links.threads && (
                          <a
                            href={k.links.threads}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" /> Threads
                          </a>
                        )}
                        {k.industry && (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {k.industry}
                          </span>
                        )}
                      </div>

                      {rates.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            <Tag className="h-3 w-3" /> Rate Card
                          </div>
                          <div className="space-y-0.5">
                            {rates.map((r, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground truncate pr-2">{rateLabel(r)}</span>
                                <span className="font-medium tabular-nums">{formatRupiah(r.rate)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {kolCamps.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1.5">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Campaign
                          </div>
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

        {/* ===== Campaigns Detail ===== */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              Campaign Detail ({campaigns.length})
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
              {campaigns.map((c) => {
                const matchedKol = kols.find((k) => k.username === c.kol_username);
                const profileUrl = matchedKol
                  ? matchedKol.links.instagram || matchedKol.links.tiktok || matchedKol.links.youtube || matchedKol.links.twitter || matchedKol.links.linkedin || matchedKol.links.threads || null
                  : null;
                return (
                <Card key={c.id} className="hub-card overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {profileUrl ? (
                          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="group">
                            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{c.kol_name}</p>
                            <p className="text-xs text-muted-foreground group-hover:underline">@{c.kol_username}</p>
                          </a>
                        ) : (
                          <>
                            <p className="font-semibold text-sm truncate">{c.kol_name}</p>
                            <p className="text-xs text-muted-foreground">@{c.kol_username}</p>
                          </>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{c.campaign_name}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {platformLabels[c.platform] || c.platform}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
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

                      {c.is_paid && (
                        <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-700 dark:text-green-400">
                          Paid
                        </Badge>
                      )}

                      {c.post_link && (
                        <a
                          href={c.post_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary text-xs hover:underline ml-auto"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Lihat Post
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-xs">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Spend</p>
                        <p className="font-semibold tabular-nums">{formatRupiah(c.budget)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Dibuat</p>
                        <p className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(c.created_at) || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Tanggal Post</p>
                        <p className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(c.posted_at) || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Tanggal Bayar</p>
                        <p className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(c.paid_at) || "—"}
                        </p>
                      </div>
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
