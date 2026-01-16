import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganicReports, useAdsReports, usePlatformAccounts } from "@/hooks/useReports";
import {
  PLATFORMS,
  MONTHS,
  PLATFORM_METRICS,
  formatCurrencyIDR,
  formatNumber,
  getMonthLabel,
  getPlatformLabel,
} from "@/lib/report-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Building2,
  Users,
  DollarSign,
  Eye,
  MousePointer,
  TrendingUp,
  ArrowLeft,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Music2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

const COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(150, 50%, 45%)",
  "hsl(35, 80%, 50%)",
  "hsl(0, 65%, 55%)",
  "hsl(280, 60%, 50%)",
  "hsl(180, 50%, 45%)",
];

const PlatformIcon = ({ platform }: { platform: string }) => {
  const iconClass = "h-4 w-4";
  switch (platform) {
    case "instagram":
      return <Instagram className={iconClass} />;
    case "facebook":
      return <Facebook className={iconClass} />;
    case "linkedin":
      return <Linkedin className={iconClass} />;
    case "youtube":
      return <Youtube className={iconClass} />;
    case "tiktok":
      return <Music2 className={iconClass} />;
    case "google_business":
      return <MapPin className={iconClass} />;
    default:
      return null;
  }
};

export function ClientAnalyticsDashboard() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, status")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: accounts = [] } = usePlatformAccounts(selectedClient || undefined);

  const { data: organicReports = [] } = useOrganicReports({
    clientId: selectedClient || undefined,
    year: parseInt(filterYear),
  });

  const { data: adsReports = [] } = useAdsReports({
    clientId: selectedClient || undefined,
    year: parseInt(filterYear),
  });

  // Monthly organic trend data
  const monthlyOrganicData = useMemo(() => {
    if (!selectedClient) return [];

    const dataByMonth: Record<number, Record<string, number>> = {};

    organicReports.forEach((report) => {
      const month = report.report_month;
      if (!dataByMonth[month]) {
        dataByMonth[month] = {};
      }

      // Get platform from the platform_accounts relation
      const platform = report.platform_accounts?.platform;
      if (!platform) return;

      const platformMetrics = PLATFORM_METRICS[platform as keyof typeof PLATFORM_METRICS];
      if (!platformMetrics) return;

      platformMetrics.metrics.forEach((metric) => {
        const value = report[metric.key] as number | null;
        if (value !== null && value !== undefined) {
          const key = `${platform}_${metric.key}`;
          dataByMonth[month][key] = (dataByMonth[month][key] || 0) + value;
        }
      });
    });

    return MONTHS.map((m) => ({
      month: m.label.slice(0, 3),
      monthNum: m.value,
      ...dataByMonth[m.value],
    }));
  }, [organicReports, selectedClient]);

  // Monthly ads trend data
  const monthlyAdsData = useMemo(() => {
    if (!selectedClient) return [];

    const dataByMonth: Record<number, { spend: number; impressions: number; clicks: number; results: number }> = {};

    adsReports.forEach((report) => {
      const month = report.report_month;
      if (!dataByMonth[month]) {
        dataByMonth[month] = { spend: 0, impressions: 0, clicks: 0, results: 0 };
      }
      dataByMonth[month].spend += report.total_spend;
      dataByMonth[month].impressions += report.impressions;
      dataByMonth[month].clicks += report.clicks;
      dataByMonth[month].results += report.results;
    });

    return MONTHS.map((m) => ({
      month: m.label.slice(0, 3),
      monthNum: m.value,
      spend: dataByMonth[m.value]?.spend || 0,
      impressions: dataByMonth[m.value]?.impressions || 0,
      clicks: dataByMonth[m.value]?.clicks || 0,
      results: dataByMonth[m.value]?.results || 0,
    }));
  }, [adsReports, selectedClient]);

  // Calculate follower growth per platform
  const followerGrowthData = useMemo(() => {
    if (!selectedClient) return [];

    const platformData: Record<string, Record<number, number>> = {};

    organicReports.forEach((report) => {
      const platform = report.platform_accounts?.platform;
      if (!platform) return;

      const followerMetricMap: Record<string, string> = {
        instagram: "ig_followers",
        facebook: "fb_followers",
        linkedin: "li_followers",
        youtube: "yt_subscribers",
        tiktok: "tt_followers",
      };

      const metricKey = followerMetricMap[platform];
      if (!metricKey) return;

      const value = report[metricKey] as number | null;
      if (value !== null && value !== undefined) {
        if (!platformData[platform]) {
          platformData[platform] = {};
        }
        // Accumulate if multiple accounts
        platformData[platform][report.report_month] =
          (platformData[platform][report.report_month] || 0) + value;
      }
    });

    return MONTHS.map((m) => {
      const row: Record<string, unknown> = { month: m.label.slice(0, 3), monthNum: m.value };
      Object.keys(platformData).forEach((platform) => {
        row[platform] = platformData[platform][m.value] || null;
      });
      return row;
    });
  }, [organicReports, selectedClient]);

  // Per-platform monthly metrics data for comparison charts
  const platformMetricsData = useMemo(() => {
    if (!selectedClient) return {};

    const result: Record<string, {
      platform: string;
      label: string;
      data: Array<Record<string, unknown>>;
      metrics: Array<{ key: string; label: string; color: string }>;
    }> = {};

    // Group reports by platform
    const reportsByPlatform: Record<string, typeof organicReports> = {};
    organicReports.forEach((report) => {
      const platform = report.platform_accounts?.platform;
      if (!platform) return;
      if (!reportsByPlatform[platform]) {
        reportsByPlatform[platform] = [];
      }
      reportsByPlatform[platform].push(report);
    });

    // Build chart data for each platform
    Object.entries(reportsByPlatform).forEach(([platform, reports]) => {
      const platformConfig = PLATFORM_METRICS[platform as keyof typeof PLATFORM_METRICS];
      if (!platformConfig) return;

      const monthlyData: Record<number, Record<string, number>> = {};

      reports.forEach((report) => {
        const month = report.report_month;
        if (!monthlyData[month]) {
          monthlyData[month] = {};
        }

        platformConfig.metrics.forEach((metric) => {
          const value = report[metric.key] as number | null;
          if (value !== null && value !== undefined) {
            monthlyData[month][metric.key] = (monthlyData[month][metric.key] || 0) + value;
          }
        });
      });

      // Convert to chart format
      const chartData = MONTHS.map((m) => ({
        month: m.label.slice(0, 3),
        monthNum: m.value,
        ...monthlyData[m.value],
      }));

      // Filter metrics that have data
      const metricsWithData = platformConfig.metrics.filter((metric) =>
        chartData.some((d) => d[metric.key] !== undefined && d[metric.key] !== null)
      );

      if (metricsWithData.length > 0) {
        result[platform] = {
          platform,
          label: platformConfig.label,
          data: chartData,
          metrics: metricsWithData.map((m, i) => ({
            key: m.key,
            label: m.label,
            color: COLORS[i % COLORS.length],
          })),
        };
      }
    });

    return result;
  }, [organicReports, selectedClient]);

  // Get available platforms with data
  const availablePlatforms = Object.keys(platformMetricsData);

  // Summary stats for selected client
  const clientStats = useMemo(() => {
    const totalSpend = adsReports.reduce((sum, r) => sum + r.total_spend, 0);
    const totalImpressions = adsReports.reduce((sum, r) => sum + r.impressions, 0);
    const totalClicks = adsReports.reduce((sum, r) => sum + r.clicks, 0);
    const totalResults = adsReports.reduce((sum, r) => sum + r.results, 0);

    // Get latest follower counts
    const latestFollowers: Record<string, number> = {};
    organicReports.forEach((r) => {
      const platform = r.platform_accounts?.platform;
      if (!platform) return;

      const followerMetricMap: Record<string, string> = {
        instagram: "ig_followers",
        facebook: "fb_followers",
        linkedin: "li_followers",
        youtube: "yt_subscribers",
        tiktok: "tt_followers",
      };

      const metricKey = followerMetricMap[platform];
      if (metricKey && r[metricKey]) {
        latestFollowers[platform] = Math.max(
          latestFollowers[platform] || 0,
          r[metricKey] as number
        );
      }
    });

    const totalFollowers = Object.values(latestFollowers).reduce((sum, v) => sum + v, 0);

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalResults,
      totalFollowers,
      accountsCount: accounts.length,
      hasAds: adsReports.length > 0,
    };
  }, [organicReports, adsReports, accounts]);

  const selectedClientData = clients.find((c) => c.id === selectedClient);
  const hasAdsData = adsReports.length > 0;
  const followerPlatforms = Object.keys(
    followerGrowthData[0] || {}
  ).filter((k) => k !== "month" && k !== "monthNum");

  // Client selection view
  if (!selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Pilih Client untuk Analytics</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedClient(client.id)}
            >
              <CardContent className="pt-4">
                <h3 className="font-medium truncate">{client.name}</h3>
                {client.company && (
                  <p className="text-sm text-muted-foreground truncate">{client.company}</p>
                )}
                <Badge
                  variant={client.status === "active" ? "default" : "secondary"}
                  className="mt-2"
                >
                  {client.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {clients.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Belum ada data client
          </div>
        )}
      </div>
    );
  }

  // Client detail view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedClient(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{selectedClientData?.name}</h2>
            {selectedClientData?.company && (
              <p className="text-sm text-muted-foreground">{selectedClientData.company}</p>
            )}
          </div>
        </div>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Platform Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Platform Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada akun terdaftar</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => (
                <Badge key={account.id} variant="outline" className="flex items-center gap-2 py-1.5">
                  <PlatformIcon platform={account.platform} />
                  <span>{account.account_name}</span>
                  <span className="text-xs text-muted-foreground">({getPlatformLabel(account.platform)})</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Followers</span>
            </div>
            <p className="text-xl md:text-2xl font-bold mt-2">
              {formatNumber(clientStats.totalFollowers)}
            </p>
          </CardContent>
        </Card>
        {hasAdsData && (
          <>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Ads Spend</span>
                </div>
                <p className="text-xl md:text-2xl font-bold mt-2">
                  {formatCurrencyIDR(clientStats.totalSpend)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Impressions</span>
                </div>
                <p className="text-xl md:text-2xl font-bold mt-2">
                  {formatNumber(clientStats.totalImpressions)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <MousePointer className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Clicks</span>
                </div>
                <p className="text-xl md:text-2xl font-bold mt-2">
                  {formatNumber(clientStats.totalClicks)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Follower Growth Chart */}
      {followerPlatforms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Pertumbuhan Followers {filterYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={followerGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis
                    tickFormatter={(v) => formatNumber(v)}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number) => formatNumber(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  {followerPlatforms.map((platform, index) => (
                    <Line
                      key={platform}
                      type="monotone"
                      dataKey={platform}
                      name={getPlatformLabel(platform)}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: COLORS[index % COLORS.length] }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Platform Metrics Comparison Charts */}
      {availablePlatforms.length > 0 && (
        <>
          <Separator />
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Platform Metrics Comparison</h3>
          </div>
          <p className="text-sm text-muted-foreground -mt-4">
            Comparing data bulan ke bulan per platform untuk melihat pertumbuhan
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {availablePlatforms.map((platform) => {
              const platformData = platformMetricsData[platform];
              if (!platformData) return null;

              return (
                <Card key={platform}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <PlatformIcon platform={platform} />
                      {platformData.label} - Monthly Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={platformData.data}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis
                            tickFormatter={(v) => {
                              if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                              if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                              return v.toString();
                            }}
                            className="text-xs"
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              const metric = platformData.metrics.find((m) => m.key === name);
                              if (metric?.label.includes("%")) {
                                return `${value}%`;
                              }
                              return formatNumber(value);
                            }}
                            labelFormatter={(label) => `${label} ${filterYear}`}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          {platformData.metrics.map((metric) => (
                            <Line
                              key={metric.key}
                              type="monotone"
                              dataKey={metric.key}
                              name={metric.label}
                              stroke={metric.color}
                              strokeWidth={2}
                              dot={{ fill: metric.color, r: 3 }}
                              connectNulls
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* MoM Growth Table per Platform */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Month-over-Month Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {availablePlatforms.map((platform) => {
                  const platformData = platformMetricsData[platform];
                  if (!platformData) return null;

                  return (
                    <div key={platform} className="space-y-2">
                      <div className="flex items-center gap-2 font-medium">
                        <PlatformIcon platform={platform} />
                        {platformData.label}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 min-w-[100px]">Metric</th>
                              {MONTHS.slice(0, 12).map((m) => (
                                <th key={m.value} className="text-right py-2 px-2 min-w-[70px]">
                                  {m.label.slice(0, 3)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {platformData.metrics.map((metric) => (
                              <tr key={metric.key} className="border-b">
                                <td className="py-2 px-2 font-medium text-muted-foreground">
                                  {metric.label}
                                </td>
                                {platformData.data.map((d, i) => {
                                  const value = d[metric.key] as number | undefined;
                                  const prevValue = i > 0 ? (platformData.data[i - 1][metric.key] as number | undefined) : undefined;
                                  const growth = value && prevValue ? ((value - prevValue) / prevValue) * 100 : null;

                                  return (
                                    <td key={i} className="text-right py-2 px-2">
                                      <div className="flex flex-col items-end">
                                        <span>{value ? formatNumber(value) : "-"}</span>
                                        {growth !== null && (
                                          <span
                                            className={`text-xs ${
                                              growth >= 0 ? "text-green-600" : "text-red-500"
                                            }`}
                                          >
                                            {growth >= 0 ? "+" : ""}
                                            {growth.toFixed(1)}%
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Ads Section - Only show if has ads data */}
      {hasAdsData && (
        <>
          <Separator />
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Ads Performance</h3>
          </div>

          {/* Monthly Ads Spend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Ads Spend Trend {filterYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyAdsData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis
                      tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                      className="text-xs"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "spend") return formatCurrencyIDR(value);
                        return formatNumber(value);
                      }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="spend"
                      name="Spend"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Ads Metrics Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Ads Metrics {filterYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyAdsData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis tickFormatter={(v) => formatNumber(v)} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => formatNumber(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      name="Impressions"
                      stroke={COLORS[0]}
                      strokeWidth={2}
                      dot={{ fill: COLORS[0] }}
                    />
                    <Line
                      type="monotone"
                      dataKey="clicks"
                      name="Clicks"
                      stroke={COLORS[1]}
                      strokeWidth={2}
                      dot={{ fill: COLORS[1] }}
                    />
                    <Line
                      type="monotone"
                      dataKey="results"
                      name="Results"
                      stroke={COLORS[2]}
                      strokeWidth={2}
                      dot={{ fill: COLORS[2] }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Ads Report Detail Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Detail Ads Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Bulan</th>
                      <th className="text-left py-2 px-2">Platform</th>
                      <th className="text-right py-2 px-2">Spend</th>
                      <th className="text-right py-2 px-2">CPM</th>
                      <th className="text-right py-2 px-2">CPC</th>
                      <th className="text-right py-2 px-2">CPR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsReports.map((report) => (
                      <tr key={report.id} className="border-b">
                        <td className="py-2 px-2">{getMonthLabel(report.report_month)}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <PlatformIcon platform={report.platform} />
                            {getPlatformLabel(report.platform)}
                          </div>
                        </td>
                        <td className="text-right py-2 px-2">{formatCurrencyIDR(report.total_spend)}</td>
                        <td className="text-right py-2 px-2">{formatCurrencyIDR(report.cpm || 0)}</td>
                        <td className="text-right py-2 px-2">{formatCurrencyIDR(report.cpc || 0)}</td>
                        <td className="text-right py-2 px-2">{formatCurrencyIDR(report.cost_per_result || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Organic Data Comparison Table */}
      <Separator />
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Organic Data Comparison</h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Data per Bulan {filterYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Bulan</th>
                  <th className="text-left py-2 px-2">Platform</th>
                  <th className="text-left py-2 px-2">Akun</th>
                  <th className="text-right py-2 px-2">Reach</th>
                  <th className="text-right py-2 px-2">Impressions</th>
                  <th className="text-right py-2 px-2">Followers</th>
                </tr>
              </thead>
              <tbody>
                {organicReports.map((report) => {
                  const platform = report.platform_accounts?.platform || "";
                  const followerKey =
                    platform === "instagram"
                      ? "ig_followers"
                      : platform === "facebook"
                      ? "fb_followers"
                      : platform === "linkedin"
                      ? "li_followers"
                      : platform === "youtube"
                      ? "yt_subscribers"
                      : platform === "tiktok"
                      ? "tt_followers"
                      : "";

                  const reachKey =
                    platform === "instagram"
                      ? "ig_reach"
                      : platform === "facebook"
                      ? "fb_reach"
                      : "";

                  const impressionsKey =
                    platform === "instagram"
                      ? "ig_impressions"
                      : platform === "facebook"
                      ? "fb_impressions"
                      : platform === "linkedin"
                      ? "li_impressions"
                      : platform === "youtube"
                      ? "yt_impressions"
                      : "";

                  return (
                    <tr key={report.id} className="border-b">
                      <td className="py-2 px-2">{getMonthLabel(report.report_month)}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={platform} />
                          {getPlatformLabel(platform)}
                        </div>
                      </td>
                      <td className="py-2 px-2">{report.platform_accounts?.account_name}</td>
                      <td className="text-right py-2 px-2">
                        {reachKey && report[reachKey] ? formatNumber(report[reachKey] as number) : "-"}
                      </td>
                      <td className="text-right py-2 px-2">
                        {impressionsKey && report[impressionsKey]
                          ? formatNumber(report[impressionsKey] as number)
                          : "-"}
                      </td>
                      <td className="text-right py-2 px-2">
                        {followerKey && report[followerKey]
                          ? formatNumber(report[followerKey] as number)
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
