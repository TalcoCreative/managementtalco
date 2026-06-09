import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { format } from "date-fns";

const fmt = (n: number | null | undefined) => n == null ? "-" : n.toLocaleString();

export function ContentDetailDialog({ open, onOpenChange, content }: { open: boolean; onOpenChange: (v: boolean) => void; content: any }) {
  const { data: snapshots } = useQuery({
    queryKey: ["content-snapshots", content?.id],
    queryFn: async () => {
      if (!content?.id) return [];
      const { data } = await supabase.from("published_content_snapshots").select("*").eq("content_id", content.id).order("snapshot_at", { ascending: false });
      return data || [];
    },
    enabled: !!content?.id && open,
  });

  if (!content) return null;
  const first = snapshots?.[snapshots.length - 1];
  const last = snapshots?.[0];
  const growth = (a?: number | null, b?: number | null) => (a == null || b == null) ? "-" : `${b - a >= 0 ? "+" : ""}${(b - a).toLocaleString()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {content.title || content.content_url}
            <Badge variant="outline">{content.platform}</Badge>
            {content.performance_score && <Badge>{content.performance_score}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            {content.thumbnail_url && <img src={content.thumbnail_url} className="w-24 h-24 rounded object-cover" alt="" />}
            <div className="flex-1 text-sm space-y-1">
              <a href={content.content_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline break-all">
                {content.content_url} <ExternalLink className="h-3 w-3" />
              </a>
              <p className="text-muted-foreground">Type: {content.content_type}</p>
              {content.publish_date && <p className="text-muted-foreground">Published: {format(new Date(content.publish_date), "dd MMM yyyy")}</p>}
              {content.caption_preview && <p className="text-xs text-muted-foreground line-clamp-3">{content.caption_preview}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: Eye, label: "Views", v: content.latest_views },
              { icon: Heart, label: "Likes", v: content.latest_likes },
              { icon: MessageCircle, label: "Comments", v: content.latest_comments },
              { icon: Share2, label: "Shares", v: content.latest_shares },
            ].map(({ icon: Icon, label, v }) => (
              <Card key={label}><CardContent className="p-3 text-center">
                <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{fmt(v)}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent></Card>
            ))}
          </div>

          {content.latest_engagement_rate != null && (
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{content.latest_engagement_rate}%</p>
              <p className="text-xs text-muted-foreground">Engagement Rate</p>
            </CardContent></Card>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2">Historical Snapshots ({snapshots?.length || 0})</h4>
            {snapshots && snapshots.length > 1 && first && last && (
              <div className="text-xs text-muted-foreground mb-2 flex flex-wrap gap-3">
                <span>Views growth: {growth(first.views, last.views)}</span>
                <span>Likes growth: {growth(first.likes, last.likes)}</span>
                <span>Comments growth: {growth(first.comments, last.comments)}</span>
              </div>
            )}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {snapshots?.map((s: any) => (
                <div key={s.id} className="text-xs flex flex-wrap gap-3 p-2 bg-muted/30 rounded">
                  <span>{format(new Date(s.snapshot_at), "dd MMM yyyy HH:mm")}</span>
                  <span>👁 {fmt(s.views)}</span>
                  <span>❤ {fmt(s.likes)}</span>
                  <span>💬 {fmt(s.comments)}</span>
                  {s.engagement_rate != null && <span>ER {s.engagement_rate}%</span>}
                </div>
              ))}
              {(!snapshots || snapshots.length === 0) && <p className="text-xs text-muted-foreground">Belum ada snapshot.</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
