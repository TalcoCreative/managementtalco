import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Building2, AlertCircle, DollarSign, Package, Eye, 
  MousePointer, Megaphone, Users, ShoppingBag,
} from "lucide-react";

const MARKETPLACES = [
  { value: "tokopedia", label: "Tokopedia", color: "bg-green-100 text-green-800" },
  { value: "shopee", label: "Shopee", color: "bg-orange-100 text-orange-800" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const formatNumber = (n: number) =>
  new Intl.NumberFormat("id-ID").format(n);

interface MarketplaceReport {
  id: string;
  marketplace: string;
  report_month: number;
  report_year: number;
  total_revenue: number | null;
  total_orders: number | null;
  total_products_sold: number | null;
  store_visitors: number | null;
  conversion_rate: number | null;
  avg_order_value: number | null;
  page_views: number | null;
  unique_visitors: number | null;
  bounce_rate: number | null;
  ads_spend: number | null;
  ads_impressions: number | null;
  ads_clicks: number | null;
  ads_roas: number | null;
  ads_cpc: number | null;
}

export default function PublicMarketplace() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("selling");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-marketplace", clientSlug, selectedYear],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${baseUrl}/functions/v1/public-marketplace?slug=${encodeURIComponent(clientSlug || "")}&year=${selectedYear}`,
        { headers: { "Content-Type": "application/json", apikey: apiKey } }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!clientSlug,
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] hub-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ShoppingBag className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">Memuat marketplace data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] hub-gradient flex items-center justify-center px-4">
        <div className="text-center hub-card p-8 rounded-3xl max-w-sm w-full">
          <AlertCircle className="h-7 w-7 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Data Tidak Ditemukan</h1>
          <p className="text-sm text-muted-foreground">Marketplace data tidak tersedia.</p>
        </div>
      </div>
    );
  }

  const { client, reports, availableYears } = data as {
    client: { id: string; name: string; company: string | null; dashboard_slug: string; client_logo: string | null };
    reports: MarketplaceReport[];
    availableYears: number[];
  };

  // Update year if current year has no data
  const yearsToShow = availableYears.length > 0 ? availableYears : [new Date().getFullYear()];

  const hasAdsData = reports.some((r) => (r.ads_spend || 0) > 0 || (r.ads_clicks || 0) > 0);

  // Chart data
  const chartData = MONTHS.map((month, idx) => {
    const monthReports = reports.filter((r) => r.report_month === idx + 1);
    const tokopedia = monthReports.find((r) => r.marketplace === "tokopedia");
    const shopee = monthReports.find((r) => r.marketplace === "shopee");
    return {
      month,
      tokopedia_revenue: tokopedia?.total_revenue || 0,
      shopee_revenue: shopee?.total_revenue || 0,
      tokopedia_orders: tokopedia?.total_orders || 0,
      shopee_orders: shopee?.total_orders || 0,
      tokopedia_visitors: tokopedia?.store_visitors || 0,
      shopee_visitors: shopee?.store_visitors || 0,
      tokopedia_page_views: tokopedia?.page_views || 0,
      shopee_page_views: shopee?.page_views || 0,
      tokopedia_ads_spend: tokopedia?.ads_spend || 0,
      shopee_ads_spend: shopee?.ads_spend || 0,
      tokopedia_ads_clicks: tokopedia?.ads_clicks || 0,
      shopee_ads_clicks: shopee?.ads_clicks || 0,
    };
  });

  const totalRevenue = reports.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalOrders = reports.reduce((s, r) => s + (r.total_orders || 0), 0);
  const totalVisitors = reports.reduce((s, r) => s + (r.store_visitors || 0), 0);
  const totalPageViews = reports.reduce((s, r) => s + (r.page_views || 0), 0);
  const totalAdsSpend = reports.reduce((s, r) => s + (r.ads_spend || 0), 0);
  const totalAdsClicks = reports.reduce((s, r) => s + (r.ads_clicks || 0), 0);

  return (
    <div className="min-h-[100dvh] hub-gradient">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4" />
        <div className="relative container mx-auto px-4 pt-8 pb-6 sm:pt-10 sm:pb-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="hub-logo-container w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center overflow-hidden">
              {client.client_logo ? (
                <img src={client.client_logo} alt="" className="w-full h-full object-contain p-1.5" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">{client.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{client.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Marketplace Performance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-8 space-y-5">
        {/* Year filter */}
        <div className="flex justify-end">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearsToShow.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="hub-card rounded-2xl border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-100 shrink-0"><DollarSign className="h-4 w-4 text-green-700" /></div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Revenue</p>
                  <p className="text-xs font-bold truncate">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hub-card rounded-2xl border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 shrink-0"><Package className="h-4 w-4 text-blue-700" /></div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Orders</p>
                  <p className="text-xs font-bold">{formatNumber(totalOrders)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hub-card rounded-2xl border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-100 shrink-0"><Eye className="h-4 w-4 text-purple-700" /></div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Visitors</p>
                  <p className="text-xs font-bold">{formatNumber(totalVisitors)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hub-card rounded-2xl border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 shrink-0"><Users className="h-4 w-4 text-indigo-700" /></div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Page Views</p>
                  <p className="text-xs font-bold">{formatNumber(totalPageViews)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {hasAdsData && (
            <>
              <Card className="hub-card rounded-2xl border-0">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-red-100 shrink-0"><Megaphone className="h-4 w-4 text-red-700" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground truncate">Ads Spend</p>
                      <p className="text-xs font-bold truncate">{formatCurrency(totalAdsSpend)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hub-card rounded-2xl border-0">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 shrink-0"><MousePointer className="h-4 w-4 text-amber-700" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground truncate">Ads Clicks</p>
                      <p className="text-xs font-bold">{formatNumber(totalAdsClicks)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="selling" className="flex-1 sm:flex-initial">Selling</TabsTrigger>
            <TabsTrigger value="traffic" className="flex-1 sm:flex-initial">Traffic</TabsTrigger>
            {hasAdsData && <TabsTrigger value="ads" className="flex-1 sm:flex-initial">Ads</TabsTrigger>}
          </TabsList>

          {/* SELLING */}
          <TabsContent value="selling" className="space-y-4 mt-4">
            <Card className="hub-card rounded-2xl border-0">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="tokopedia_revenue" name="Tokopedia" fill="hsl(140, 60%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="shopee_revenue" name="Shopee" fill="hsl(25, 90%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="hub-card rounded-2xl border-0">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Orders Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="tokopedia_orders" name="Tokopedia" stroke="hsl(140, 60%, 45%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="shopee_orders" name="Shopee" stroke="hsl(25, 90%, 55%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Selling table */}
            <Card className="hub-card rounded-2xl border-0">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Detail</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Bulan</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Conv.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Belum ada data</TableCell></TableRow>
                      ) : reports.map((r) => {
                        const mp = MARKETPLACES.find(m => m.value === r.marketplace);
                        return (
                          <TableRow key={r.id}>
                            <TableCell><Badge variant="outline" className={mp?.color}>{mp?.label}</Badge></TableCell>
                            <TableCell>{MONTHS[r.report_month - 1]}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.total_revenue || 0)}</TableCell>
                            <TableCell className="text-right">{formatNumber(r.total_orders || 0)}</TableCell>
                            <TableCell className="text-right">{(r.conversion_rate || 0).toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TRAFFIC */}
          <TabsContent value="traffic" className="space-y-4 mt-4">
            <Card className="hub-card rounded-2xl border-0">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Visitors Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatNumber(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="tokopedia_visitors" name="Tokopedia" fill="hsl(140, 60%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="shopee_visitors" name="Shopee" fill="hsl(25, 90%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="hub-card rounded-2xl border-0">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Detail Traffic</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Bulan</TableHead>
                        <TableHead className="text-right">Visitors</TableHead>
                        <TableHead className="text-right">Page Views</TableHead>
                        <TableHead className="text-right">Bounce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Belum ada data</TableCell></TableRow>
                      ) : reports.map((r) => {
                        const mp = MARKETPLACES.find(m => m.value === r.marketplace);
                        return (
                          <TableRow key={r.id}>
                            <TableCell><Badge variant="outline" className={mp?.color}>{mp?.label}</Badge></TableCell>
                            <TableCell>{MONTHS[r.report_month - 1]}</TableCell>
                            <TableCell className="text-right">{formatNumber(r.store_visitors || 0)}</TableCell>
                            <TableCell className="text-right">{formatNumber(r.page_views || 0)}</TableCell>
                            <TableCell className="text-right">{(r.bounce_rate || 0).toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ADS */}
          {hasAdsData && (
            <TabsContent value="ads" className="space-y-4 mt-4">
              <Card className="hub-card rounded-2xl border-0">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Ads Spend Trend</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="tokopedia_ads_spend" name="Tokopedia" fill="hsl(140, 60%, 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="shopee_ads_spend" name="Shopee" fill="hsl(25, 90%, 55%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="hub-card rounded-2xl border-0">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Detail Ads</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Platform</TableHead>
                          <TableHead>Bulan</TableHead>
                          <TableHead className="text-right">Spend</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">CPC</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((r) => {
                          const mp = MARKETPLACES.find(m => m.value === r.marketplace);
                          return (
                            <TableRow key={r.id}>
                              <TableCell><Badge variant="outline" className={mp?.color}>{mp?.label}</Badge></TableCell>
                              <TableCell>{MONTHS[r.report_month - 1]}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.ads_spend || 0)}</TableCell>
                              <TableCell className="text-right">{formatNumber(r.ads_clicks || 0)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.ads_cpc || 0)}</TableCell>
                              <TableCell className="text-right">{(r.ads_roas || 0).toFixed(2)}x</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Footer */}
        <div className="pt-4 pb-2 text-center">
          <p className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">
            Powered by Talco Management System
          </p>
        </div>
      </main>
    </div>
  );
}
