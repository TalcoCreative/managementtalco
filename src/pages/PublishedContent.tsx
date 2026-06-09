import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Plus, RefreshCw, Settings, ExternalLink, Search, Eye, Heart, MessageCircle, TrendingUp, Loader2, Trophy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AddContentDialog } from "@/components/published-content/AddContentDialog";
import { ContentDetailDialog } from "@/components/published-content/ContentDetailDialog";
import { SettingsDialog } from "@/components/published-content/SettingsDialog";

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook",
  linkedin: "LinkedIn", twitter: "X", threads: "Threads", website: "Website", other: "Other",
};

const SCORE_COLOR: Record<string, string> = {
  Excellent: "bg-emerald-500", Good: "bg-blue-500", Average: "bg-amber-500", Poor: "bg-red-500",
};

const fmt = (n: number | null | undefined) => n == null ? "-" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

export default function PublishedContent() {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [score, setScore] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ["all-published-contents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_contents")
        .select("*, campaign:kol_campaigns(id,campaign_name), client:clients(id,name), kol:kol_database(id,name,username)")
        .order("publish_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Also keep legacy EP slides (existing feature)
  const { data: epSlides } = useQuery({
    queryKey: ["published-slides-summary"],
    queryFn: async () => {
      const { data } = await supabase
        .from("editorial_slides")
        .select("id, published_at, publish_date, publish_links, editorial_plans(title, clients(name))")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let arr = items || [];
    if (platform !== "all") arr = arr.filter(c => c.platform === platform);
    if (score !== "all") arr = arr.filter(c => c.performance_score === score);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(c =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.content_url || "").toLowerCase().includes(q) ||
        (c.client?.name || "").toLowerCase().includes(q) ||
        (c.kol?.name || "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [items, platform, score, search]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const sum = (k: string) => filtered.reduce((s, c: any) => s + (c[k] || 0), 0);
    const views = sum("latest_views");
    const likes = sum("latest_likes");
    const comments = sum("latest_comments");
    const ers = filtered.map((c: any) => c.latest_engagement_rate).filter((v: any) => v != null);
    const avgER = ers.length ? (ers.reduce((a: number, b: number) => a + b, 0) / ers.length) : 0;
    const best = [...filtered].sort((a: any, b: any) => (b.latest_engagement_rate || 0) - (a.latest_engagement_rate || 0))[0];
    const platformCounts: Record<string, number> = {};
    filtered.forEach((c: any) => { platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1; });
    const bestPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { total, views, likes, comments, avgER: +avgER.toFixed(2), best, bestPlatform };
  }, [filtered]);

  const topByViews = useMemo(() => [...filtered].sort((a: any, b: any) => (b.latest_views || 0) - (a.latest_views || 0)).slice(0, 10), [filtered]);
  const topByER = useMemo(() => [...filtered].sort((a: any, b: any) => (b.latest_engagement_rate || 0) - (a.latest_engagement_rate || 0)).slice(0, 10), [filtered]);

  const refreshAll = async () => {
    if (!filtered.length) return;
    setRefreshingAll(true);
    let ok = 0, fail = 0;
    for (const c of filtered) {
      try {
        const { data } = await supabase.functions.invoke("scrape-content", { body: { content_id: c.id } });
        if (data?.ok !== false) ok++; else fail++;
      } catch { fail++; }
    }
    setRefreshingAll(false);
    toast.success(`Refresh selesai: ${ok} ok, ${fail} gagal`);
    refetch();
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="section-header" style={{ "--section-color": "var(--section-social)" } as React.CSSProperties}>
          <div className="section-icon"><BarChart3 className="h-5 w-5" /></div>
          <div className="flex-1">
            <h1 className="section-title">Published Content Analytics</h1>
            <p className="section-subtitle">Monitor performa publik seluruh konten yang sudah dipublikasikan</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><Settings className="h-4 w-4 mr-1" /> Thresholds</Button>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshingAll}>
              {refreshingAll ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />} Refresh All
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Content</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "Total Content", v: summary.total, icon: BarChart3 },
            { label: "Total Views", v: fmt(summary.views), icon: Eye },
            { label: "Total Likes", v: fmt(summary.likes), icon: Heart },
            { label: "Total Comments", v: fmt(summary.comments), icon: MessageCircle },
            { label: "Avg ER", v: `${summary.avgER}%`, icon: TrendingUp },
            { label: "Top Platform", v: summary.bestPlatform ? PLATFORM_LABEL[summary.bestPlatform] || summary.bestPlatform : "-", icon: Trophy },
            { label: "Best Content", v: summary.best?.title?.slice(0, 16) || summary.best?.platform || "-", icon: Trophy },
          ].map(({ label, v, icon: Icon }) => (
            <Card key={label}><CardContent className="p-3">
              <Icon className="h-4 w-4 mb-1 text-muted-foreground" />
              <p className="text-lg font-bold truncate">{v}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, URL, client, KOL..." className="pl-9" />
            </div>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {Object.entries(PLATFORM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={score} onValueChange={setScore}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Score" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="Excellent">Excellent</SelectItem>
                <SelectItem value="Good">Good</SelectItem>
                <SelectItem value="Average">Average</SelectItem>
                <SelectItem value="Poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table">Performance Table</TabsTrigger>
            <TabsTrigger value="top">Top Content</TabsTrigger>
            <TabsTrigger value="ep">From Editorial Plan ({epSlides?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="table">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Content</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Creator / KOL</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Publish</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Likes</TableHead>
                      <TableHead className="text-right">Comments</TableHead>
                      <TableHead className="text-right">ER%</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-8">Loading...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Belum ada konten. Klik "Add Content" untuk mulai.</TableCell></TableRow>
                    ) : filtered.map((c: any) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                        <TableCell className="max-w-[240px]">
                          <div className="flex items-center gap-2">
                            {c.thumbnail_url && <img src={c.thumbnail_url} className="w-8 h-8 rounded object-cover flex-shrink-0" alt="" />}
                            <div className="min-w-0">
                              <p className="font-medium truncate text-sm">{c.title || c.content_url}</p>
                              <a href={c.content_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                                {c.content_type} <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{PLATFORM_LABEL[c.platform] || c.platform}</Badge></TableCell>
                        <TableCell className="text-sm">{c.kol?.name || "-"}</TableCell>
                        <TableCell className="text-sm">{c.campaign?.campaign_name || c.client?.name || "-"}</TableCell>
                        <TableCell className="text-xs">{c.publish_date ? format(new Date(c.publish_date), "dd MMM yyyy") : "-"}</TableCell>
                        <TableCell className="text-right">{fmt(c.latest_views)}</TableCell>
                        <TableCell className="text-right">{fmt(c.latest_likes)}</TableCell>
                        <TableCell className="text-right">{fmt(c.latest_comments)}</TableCell>
                        <TableCell className="text-right">{c.latest_engagement_rate != null ? `${c.latest_engagement_rate}%` : "-"}</TableCell>
                        <TableCell>{c.performance_score ? <Badge className={`${SCORE_COLOR[c.performance_score]} text-white`}>{c.performance_score}</Badge> : "-"}</TableCell>
                        <TableCell className="text-xs">{c.last_scraped_at ? format(new Date(c.last_scraped_at), "dd MMM HH:mm") : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card><CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Eye className="h-4 w-4" /> Top 10 by Views</h3>
                <div className="space-y-2">
                  {topByViews.map((c: any, i: number) => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer" onClick={() => setDetail(c)}>
                      <span className="text-xs font-bold w-5 text-muted-foreground">#{i + 1}</span>
                      <span className="flex-1 text-sm truncate">{c.title || c.content_url}</span>
                      <span className="text-sm font-medium">{fmt(c.latest_views)}</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Top 10 by Engagement Rate</h3>
                <div className="space-y-2">
                  {topByER.map((c: any, i: number) => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer" onClick={() => setDetail(c)}>
                      <span className="text-xs font-bold w-5 text-muted-foreground">#{i + 1}</span>
                      <span className="flex-1 text-sm truncate">{c.title || c.content_url}</span>
                      <span className="text-sm font-medium">{c.latest_engagement_rate != null ? `${c.latest_engagement_rate}%` : "-"}</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="ep">
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground">Konten yang ditandai "published" dari Editorial Plan.</p>
                {epSlides?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada slide yang dipublish.</p>}
                {epSlides?.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.editorial_plans?.title || "EP"} — {s.editorial_plans?.clients?.name}</p>
                      <p className="text-xs text-muted-foreground">{s.published_at ? format(new Date(s.published_at), "dd MMM yyyy") : "-"}</p>
                    </div>
                    <div className="flex gap-1">
                      {(s.publish_links as any[])?.slice(0, 4).map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70 inline-flex items-center gap-1">
                          {l.platform} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddContentDialog open={addOpen} onOpenChange={setAddOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {detail && <ContentDetailDialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)} content={detail} />}
    </AppLayout>
  );
}
