import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Trash2, Eye, Heart, MessageCircle, Share2, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";

const CONTENT_TYPES = [
  { value: "ig_feed", label: "Instagram Feed" },
  { value: "ig_reel", label: "Instagram Reel" },
  { value: "ig_story", label: "Instagram Story" },
  { value: "ig_carousel", label: "Instagram Carousel" },
  { value: "tiktok_video", label: "TikTok Video" },
  { value: "youtube_video", label: "YouTube Video" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "facebook_post", label: "Facebook Post" },
  { value: "twitter_post", label: "X Post" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "website_article", label: "Website Article" },
  { value: "other", label: "Other" },
];

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

const fmt = (n: number | null | undefined) => n == null ? "-" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export function PublishedContentSubmission({ campaign }: { campaign: any }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [contentType, setContentType] = useState("ig_reel");
  const [publishDate, setPublishDate] = useState("");
  const [captionNotes, setCaptionNotes] = useState("");
  const [scrapingId, setScrapingId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["campaign-published-content", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_contents")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!url.trim()) throw new Error("URL wajib diisi");
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      const platform = detectPlatform(url);

      const { data: inserted, error } = await supabase
        .from("published_contents")
        .insert({
          content_url: url.trim(),
          platform,
          content_type: contentType,
          publish_date: publishDate || null,
          caption_notes: captionNotes || null,
          ig_username: campaign.kol?.username || null,
          campaign_id: campaign.id,
          kol_id: campaign.kol_id,
          client_id: campaign.client_id,
          project_id: campaign.project_id,
          creator_user_id: userId,
          created_by: userId,
          scrape_status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return inserted;
    },
    onSuccess: async (inserted) => {
      setUrl(""); setCaptionNotes(""); setPublishDate("");
      qc.invalidateQueries({ queryKey: ["campaign-published-content", campaign.id] });
      toast.success("Content URL ditambahkan. Mengambil metrik...");
      await scrape(inserted.id);
    },
    onError: (e: any) => toast.error(e.message || "Gagal menambah content"),
  });

  const scrape = async (id: string) => {
    setScrapingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-content", { body: { content_id: id } });
      if (error) throw error;
      if (data?.ok === false) toast.warning(`Scraping selesai dengan peringatan: ${data.error || "tidak ada metrik publik tersedia"}`);
      else toast.success("Metrik berhasil di-scrape");
      qc.invalidateQueries({ queryKey: ["campaign-published-content", campaign.id] });
    } catch (e: any) {
      toast.error("Gagal scrape: " + (e.message || e));
    } finally {
      setScrapingId(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("published_contents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-published-content", campaign.id] });
      toast.success("Content dihapus");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <Label>Content URL <span className="text-destructive">*</span></Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/p/xxxxx atau https://instagram.com/reel/xxxxx"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Publish Date</Label>
              <Input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Caption Notes</Label>
            <Textarea value={captionNotes} onChange={(e) => setCaptionNotes(e.target.value)} rows={2} placeholder="Catatan tambahan tentang caption / konten ini..." />
          </div>
          <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !url.trim()} className="w-full sm:w-auto">
            {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Tambah & Scrape Metrik
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Submitted Content ({items?.length || 0})</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : items?.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Belum ada konten yang di-submit.</p>
        ) : (
          items?.map((c: any) => {
            const isScraping = scrapingId === c.id;
            return (
              <Card key={c.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">{c.platform}</div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">{c.platform}</Badge>
                        <Badge variant="secondary" className="text-xs">{CONTENT_TYPES.find(t => t.value === c.content_type)?.label || c.content_type}</Badge>
                        {c.performance_score && <Badge className="text-xs">{c.performance_score}</Badge>}
                        <a href={c.content_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-sm font-medium truncate">{c.title || c.caption_preview || c.content_url}</p>
                      {c.caption_notes && <p className="text-xs text-muted-foreground line-clamp-2">{c.caption_notes}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
                        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {fmt(c.latest_views)}</span>
                        <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {fmt(c.latest_likes)}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {fmt(c.latest_comments)}</span>
                        <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" /> {fmt(c.latest_shares)}</span>
                        {c.latest_engagement_rate != null && <span>ER {c.latest_engagement_rate}%</span>}
                        {c.last_scraped_at && <span>· Updated {format(new Date(c.last_scraped_at), "dd MMM HH:mm")}</span>}
                      </div>
                      {c.scrape_status === "failed" && (
                        <p className="text-xs text-destructive">Scrape gagal: {c.scrape_error}</p>
                      )}
                    </div>
                    <div className="flex sm:flex-col gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => scrape(c.id)} disabled={isScraping} title="Refresh metrics">
                        {isScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Hapus content ini?")) deleteMutation.mutate(c.id); }} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
