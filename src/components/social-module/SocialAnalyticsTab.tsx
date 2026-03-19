import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Users,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Instagram,
  Facebook,
  BarChart3,
} from "lucide-react";
import { useSocialAccounts, useSocialAnalytics, useSocialModuleConfig } from "@/hooks/useSocialModule";

export function SocialAnalyticsTab() {
  const [accountFilter, setAccountFilter] = useState("all");
  const { data: accounts } = useSocialAccounts();
  const { data: analytics, isLoading } = useSocialAnalytics(accountFilter);
  const { config } = useSocialModuleConfig();

  // Aggregate stats
  const totalImpressions = analytics?.reduce((sum: number, a: any) => sum + (a.impressions || 0), 0) || 0;
  const totalReach = analytics?.reduce((sum: number, a: any) => sum + (a.reach || 0), 0) || 0;
  const totalEngagement = analytics?.reduce((sum: number, a: any) => sum + (a.engagement || 0), 0) || 0;
  const totalLikes = analytics?.reduce((sum: number, a: any) => sum + (a.likes || 0), 0) || 0;
  const totalComments = analytics?.reduce((sum: number, a: any) => sum + (a.comments || 0), 0) || 0;
  const totalShares = analytics?.reduce((sum: number, a: any) => sum + (a.shares || 0), 0) || 0;

  const formatNumber = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const statCards = [
    { label: "Impressions", value: totalImpressions, icon: Eye, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30" },
    { label: "Reach", value: totalReach, icon: Users, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30" },
    { label: "Engagement", value: totalEngagement, icon: TrendingUp, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30" },
    { label: "Likes", value: totalLikes, icon: Heart, color: "text-pink-500 bg-pink-100 dark:bg-pink-900/30" },
    { label: "Comments", value: totalComments, icon: MessageCircle, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30" },
    { label: "Shares", value: totalShares, icon: Share2, color: "text-sky-500 bg-sky-100 dark:bg-sky-900/30" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none">{formatNumber(s.value)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filter by Account:</span>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts?.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex items-center gap-2">
                  {a.platform === "instagram" ? (
                    <Instagram className="h-3.5 w-3.5 text-pink-500" />
                  ) : (
                    <Facebook className="h-3.5 w-3.5 text-blue-600" />
                  )}
                  {a.account_name || a.platform}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Post Analytics Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Reach</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead className="text-right">Shares</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    Loading analytics...
                  </TableCell>
                </TableRow>
              ) : !analytics?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No analytics data available yet
                  </TableCell>
                </TableRow>
              ) : (
                analytics.map((item: any) => {
                  const post = config.mode === "dummy" ? item.sm_dummy_posts : item.social_media_posts;
                  const account = config.mode === "dummy" ? item.sm_dummy_accounts : null;
                  const caption = post?.caption || "—";
                  const platform = post?.platform || account?.platform || "—";
                  const status = post?.status || "—";

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate">{caption}</p>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 capitalize">
                          {platform === "instagram" ? (
                            <Instagram className="h-3.5 w-3.5 text-pink-500" />
                          ) : (
                            <Facebook className="h-3.5 w-3.5 text-blue-600" />
                          )}
                          {platform}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            status === "published"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30"
                              : status === "scheduled"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30"
                              : ""
                          }
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.impressions || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.reach || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.engagement || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.likes || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.comments || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.shares || 0)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
