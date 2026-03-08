import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ExternalLink,
  FileText,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  Music2,
  BarChart3,
  Building2,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const CHANNEL_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  instagram: { label: "Instagram", icon: Instagram, color: "bg-pink-100 text-pink-700 border-pink-200" },
  tiktok: { label: "TikTok", icon: Music2, color: "bg-slate-100 text-slate-700 border-slate-200" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-red-100 text-red-700 border-red-200" },
  twitter: { label: "X (Twitter)", icon: FileText, color: "bg-sky-100 text-sky-700 border-sky-200" },
  facebook: { label: "Facebook", icon: Facebook, color: "bg-blue-100 text-blue-700 border-blue-200" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  threads: { label: "Threads", icon: FileText, color: "bg-gray-100 text-gray-700 border-gray-200" },
  other: { label: "Other", icon: FileText, color: "bg-muted text-muted-foreground border-border" },
};

export default function PublishedContent() {
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-published-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all published slides with EP + client data
  const { data: publishedSlides, isLoading } = useQuery({
    queryKey: ["published-slides-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editorial_slides")
        .select(`
          id, slide_order, status, published_at, publish_date, channels, publish_links, slug,
          editorial_plans(id, title, slug, client_id, clients(id, name))
        `)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch content titles from slide_blocks
  const slideIds = publishedSlides?.map(s => s.id) || [];
  const { data: contentBlocks } = useQuery({
    queryKey: ["published-content-blocks", slideIds.join(",")],
    queryFn: async () => {
      if (slideIds.length === 0) return [];
      // Batch in chunks of 50
      const results: any[] = [];
      for (let i = 0; i < slideIds.length; i += 50) {
        const chunk = slideIds.slice(i, i + 50);
        const { data } = await supabase
          .from("slide_blocks")
          .select("slide_id, content")
          .in("slide_id", chunk)
          .eq("block_type", "content_meta");
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: slideIds.length > 0,
  });

  const contentTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    contentBlocks?.forEach((b: any) => {
      if (b.content?.title) {
        map[b.slide_id] = b.content.title;
      }
    });
    return map;
  }, [contentBlocks]);

  // Filter slides
  const filteredSlides = useMemo(() => {
    if (!publishedSlides) return [];
    return publishedSlides.filter((slide: any) => {
      const clientId = slide.editorial_plans?.client_id;
      if (selectedClientId !== "all" && clientId !== selectedClientId) return false;
      if (selectedChannel !== "all") {
        const links = slide.publish_links as any[];
        if (!links?.some((l: any) => l.platform === selectedChannel)) return false;
      }
      return true;
    });
  }, [publishedSlides, selectedClientId, selectedChannel]);

  // Group by channel for stats
  const channelStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredSlides.forEach((slide: any) => {
      const links = slide.publish_links as any[];
      if (links && Array.isArray(links)) {
        links.forEach((l: any) => {
          stats[l.platform] = (stats[l.platform] || 0) + 1;
        });
      }
      // Also count channels without links
      const channels = slide.channels as string[];
      if (channels && Array.isArray(channels)) {
        channels.forEach((ch: string) => {
          if (!stats[ch]) stats[ch] = (stats[ch] || 0);
        });
      }
    });
    return stats;
  }, [filteredSlides]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Published Content</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Daftar konten yang sudah dipublish dari Editorial Plan
            </p>
          </div>
          <Button variant="outline" onClick={() => window.history.back()}>
            ← Back to Reports
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Client</SelectItem>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Platform</SelectItem>
              {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{filteredSlides.length}</p>
              <p className="text-xs text-muted-foreground">Total Published</p>
            </CardContent>
          </Card>
          {Object.entries(channelStats)
            .sort(([, a], [, b]) => b - a)
            .map(([channel, count]) => {
              const cfg = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.other;
              const Icon = cfg.icon;
              return (
                <Card key={channel}>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </CardContent>
                </Card>
              );
            })}
        </div>

        <Separator />

        {/* Content List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
        ) : filteredSlides.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Belum ada konten yang dipublish</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredSlides.map((slide: any) => {
              const ep = slide.editorial_plans;
              const clientName = ep?.clients?.name || "Unknown";
              const title = contentTitleMap[slide.id] || `Slide ${slide.slide_order + 1}`;
              const links = (slide.publish_links as any[]) || [];
              const publishedAt = slide.published_at 
                ? format(new Date(slide.published_at), "dd MMM yyyy", { locale: localeId })
                : "-";

              return (
                <Card key={slide.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {clientName}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{ep?.title}</span>
                        </div>
                        <h3 className="font-medium truncate">{title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Published: {publishedAt}
                        </p>
                      </div>

                      {/* Links */}
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {links.map((link: any, idx: number) => {
                          const cfg = CHANNEL_CONFIG[link.platform] || CHANNEL_CONFIG.other;
                          const Icon = cfg.icon;
                          return (
                            <a
                              key={idx}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors hover:opacity-80 ${cfg.color}`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {cfg.label}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
