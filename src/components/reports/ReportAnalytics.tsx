import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganicReports, useAdsReports } from "@/hooks/useReports";
import {
  PLATFORMS,
  MONTHS,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Eye,
  MousePointer,
} from "lucide-react";

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

export function ReportAnalytics() {
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [filterClient, setFilterClient] = useState<string>("all");
  const [viewType, setViewType] = useState<"overview" | "growth" | "comparison">("overview");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-reports"],
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

  const { data: organicReports = [] } = useOrganicReports({
    clientId: filterClient !== "all" ? filterClient : undefined,
    year: filterYear ? parseInt(filterYear) : undefined,
  });

  const { data: adsReports = [] } = useAdsReports({
    clientId: filterClient !== "all" ? filterClient : undefined,
    year: filterYear ? parseInt(filterYear) : undefined,
  });

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalAdsSpend = adsReports.reduce((sum, r) => sum + r.total_spend, 0);
    const totalImpressions = adsReports.reduce((sum, r) => sum + r.impressions, 0);
    const totalClicks = adsReports.reduce((sum, r) => sum + r.clicks, 0);
    const totalResults = adsReports.reduce((sum, r) => sum + r.results, 0);

    // Calculate total followers from organic reports (latest month per account)
    const latestFollowers: Record<string, number> = {};
    organicReports.forEach((r) => {
      const key = r.platform_account_id;
      const platform = r.platform_accounts?.platform;
      if (!platform) return;
      
      const followerKey = `${platform}_followers` as string;
      const followerMetricMap: Record<string, string> = {
        instagram: "ig_followers",
        facebook: "fb_followers",
        linkedin: "li_followers",
        youtube: "yt_subscribers",
        tiktok: "tt_followers",
      };
      
      const metricKey = followerMetricMap[platform];
      if (metricKey && r[metricKey]) {
        latestFollowers[key] = Math.max(
          latestFollowers[key] || 0,
          r[metricKey] as number
        );
      }
    });
    const totalFollowers = Object.values(latestFollowers).reduce((sum, v) => sum + v, 0);

    return {
      totalAdsSpend,
      totalImpressions,
      totalClicks,
      totalResults,
      totalFollowers,
      organicReportsCount: organicReports.length,
      adsReportsCount: adsReports.length,
    };
  }, [organicReports, adsReports]);

  // Monthly spend trend
  const monthlySpendData = useMemo(() => {
    const monthlyData: Record<number, number> = {};
    adsReports.forEach((r) => {
      monthlyData[r.report_month] = (monthlyData[r.report_month] || 0) + r.total_spend;
    });
    return MONTHS.map((m) => ({
      month: m.label.slice(0, 3),
      spend: monthlyData[m.value] || 0,
    }));
  }, [adsReports]);

  // Spend by platform
  const spendByPlatform = useMemo(() => {
    const platformData: Record<string, number> = {};
    adsReports.forEach((r) => {
      platformData[r.platform] = (platformData[r.platform] || 0) + r.total_spend;
    });
    return Object.entries(platformData).map(([platform, spend]) => ({
      name: getPlatformLabel(platform),
      value: spend,
    }));
  }, [adsReports]);

  // Spend by client
  const spendByClient = useMemo(() => {
    const clientData: Record<string, { name: string; spend: number }> = {};
    adsReports.forEach((r) => {
      const clientName = r.clients?.name || "Unknown";
      if (!clientData[r.client_id]) {
        clientData[r.client_id] = { name: clientName, spend: 0 };
      }
      clientData[r.client_id].spend += r.total_spend;
    });
    return Object.values(clientData)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);
  }, [adsReports]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Semua Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Client</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Ads Spend</span>
            </div>
            <p className="text-xl md:text-2xl font-bold mt-2">
              {formatCurrencyIDR(summaryStats.totalAdsSpend)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Impressions</span>
            </div>
            <p className="text-xl md:text-2xl font-bold mt-2">
              {formatNumber(summaryStats.totalImpressions)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Clicks</span>
            </div>
            <p className="text-xl md:text-2xl font-bold mt-2">
              {formatNumber(summaryStats.totalClicks)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Followers</span>
            </div>
            <p className="text-xl md:text-2xl font-bold mt-2">
              {formatNumber(summaryStats.totalFollowers)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spend Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Ads Spend Trend {filterYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySpendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis
                    tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyIDR(value)}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="spend"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Spend by Platform */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Ads Spend by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spendByPlatform}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {spendByPlatform.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrencyIDR(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Clients by Spend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Top Clients by Ads Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendByClient} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                    className="text-xs"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyIDR(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="spend"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Counts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Organic Reports</p>
            <p className="text-2xl font-bold">{summaryStats.organicReportsCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              reports submitted for {filterYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Ads Reports</p>
            <p className="text-2xl font-bold">{summaryStats.adsReportsCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              reports submitted for {filterYear}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
