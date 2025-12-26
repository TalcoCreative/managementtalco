import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark,
  TrendingUp,
  Instagram,
  Facebook,
  AlertCircle
} from "lucide-react";

const platformIcons = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: null,
};

export function SocialMediaAnalytics() {
  // Fetch analytics with post data
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["social-media-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_analytics")
        .select(`
          *,
          post:social_media_posts(
            id,
            platform,
            content_type,
            caption,
            client:clients(name),
            project:projects(title)
          )
        `)
        .order("fetched_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Calculate totals
  const totals = analytics?.reduce(
    (acc, item) => ({
      views: acc.views + (item.views || 0),
      reach: acc.reach + (item.reach || 0),
      likes: acc.likes + (item.likes || 0),
      comments: acc.comments + (item.comments || 0),
      shares: acc.shares + (item.shares || 0),
      saves: acc.saves + (item.saves || 0),
    }),
    { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
  ) || { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-700 dark:text-blue-400">Data Analytics</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Analytics akan ter-update otomatis setiap 1-6 jam setelah API credentials dikonfigurasi.
                Data diambil dari masing-masing platform (Instagram Insights, Facebook Insights, TikTok Analytics).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Views</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.views.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Reach</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.reach.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Likes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.likes.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Comments</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.comments.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Shares</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.shares.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Saves</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.saves.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Analytics per Post</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : analytics?.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Belum ada data analytics</p>
              <p className="text-sm text-muted-foreground mt-1">
                Data akan muncul setelah post berhasil dan API terhubung
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comments</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics?.map((item) => {
                  const PlatformIcon = item.post?.platform 
                    ? platformIcons[item.post.platform as keyof typeof platformIcons]
                    : null;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium line-clamp-1">
                            {item.post?.client?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {item.post?.caption?.substring(0, 50) || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {PlatformIcon && <PlatformIcon className="h-4 w-4" />}
                          <span className="capitalize">{item.platform}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.views?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.reach?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.likes?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.comments?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.shares?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(item.fetched_at), "dd MMM HH:mm", { locale: localeId })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
