import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, ExternalLink, Clock, CheckCircle2, AlertCircle } from "lucide-react";

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

interface KolCampaignItem {
  id: string;
  kol_name: string;
  kol_username: string;
  campaign_name: string;
  platform: string;
  status: string;
  is_posted: boolean;
  post_link: string | null;
}

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
        <p className="text-muted-foreground text-sm animate-pulse">Memuat KOL Campaign...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Gagal memuat data KOL Campaign</p>
        </div>
      </div>
    );
  }

  const campaigns: KolCampaignItem[] = data.campaigns || [];

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
              <h1 className="text-xl sm:text-2xl font-bold">KOL Campaign</h1>
              <p className="text-sm text-muted-foreground">{data.clientName}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-8 space-y-3">
        {campaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Belum ada KOL Campaign</p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((c) => (
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
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
