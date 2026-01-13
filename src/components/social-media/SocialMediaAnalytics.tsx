import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays } from "date-fns";
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
  AlertCircle,
  RefreshCw,
  Loader2,
  BarChart3,
  Users
} from "lucide-react";
import { toast } from "sonner";

const platformIcons = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: null,
};

export function SocialMediaAnalytics() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [isFetching, setIsFetching] = useState(false);

  // Fetch settings to check connection
  const { data: settings } = useQuery({
    queryKey: ["social-media-settings"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const { data, error } = await supabase
        .from("social_media_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch SocialBu accounts
  const { data: socialbuAccounts } = useQuery({
    queryKey: ["socialbu-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("socialbu_accounts")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch analytics with post data
  const { data: analytics, isLoading, refetch } = useQuery({
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
      impressions: acc.impressions + ((item as any).impressions || 0),
      video_views: acc.video_views + ((item as any).video_views || 0),
    }),
    { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0, video_views: 0 }
  ) || { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0, video_views: 0 };

  // Fetch analytics from SocialBu
  const fetchFromSocialBu = async () => {
    if (!settings?.is_connected) {
      toast.error("SocialBu belum terhubung");
      return;
    }

    setIsFetching(true);
    try {
      // Fetch posts metrics
      const { data: metricsData, error: metricsError } = await supabase.functions.invoke("socialbu-analytics", {
        body: {
          action: "fetch-posts-metrics",
          startDate: dateRange.start,
          endDate: dateRange.end,
          accounts: socialbuAccounts?.map(a => a.socialbu_account_id) || [],
        },
      });

      if (metricsError) throw metricsError;

      // Fetch account metrics
      const { data: accountData, error: accountError } = await supabase.functions.invoke("socialbu-analytics", {
        body: {
          action: "fetch-accounts-metrics",
          startDate: dateRange.start,
          endDate: dateRange.end,
          accounts: socialbuAccounts?.map(a => a.socialbu_account_id) || [],
        },
      });

      if (accountError) throw accountError;

      console.log("Metrics data:", metricsData);
      console.log("Account data:", accountData);

      toast.success("Analytics berhasil diperbarui");
      refetch();
    } catch (error: any) {
      console.error("Analytics fetch error:", error);
      toast.error(error.message || "Gagal mengambil analytics");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {!settings?.is_connected ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-700 dark:text-amber-400">SocialBu Belum Terhubung</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Hubungkan akun SocialBu di Settings untuk mengambil data analytics dari akun social media Anda.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-700 dark:text-blue-400">Data Analytics</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Data diambil dari SocialBu berdasarkan rentang tanggal yang dipilih.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-[140px]"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchFromSocialBu}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
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

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Impressions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.impressions.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Video Views</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totals.video_views.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Connected Accounts Summary */}
      {socialbuAccounts && socialbuAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Akun Terhubung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {socialbuAccounts.map((account) => {
                const Icon = platformIcons[account.platform as keyof typeof platformIcons];
                return (
                  <div 
                    key={account.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    <span className="text-sm font-medium">{account.account_name}</span>
                    <Badge variant="secondary" className="text-xs capitalize">{account.platform}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Analytics per Post</CardTitle>
          <CardDescription>
            Data engagement dan performa dari masing-masing post
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : analytics?.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Belum ada data analytics</p>
              <p className="text-sm text-muted-foreground mt-1">
                {settings?.is_connected 
                  ? "Klik tombol refresh untuk mengambil data dari SocialBu"
                  : "Hubungkan SocialBu terlebih dahulu untuk melihat analytics"
                }
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
