import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Plus, ShoppingBag, TrendingUp, Package, Eye, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { MonthYearPicker } from "./MonthYearPicker";

const MARKETPLACES = [
  { value: "tokopedia", label: "Tokopedia", color: "bg-green-100 text-green-800" },
  { value: "shopee", label: "Shopee", color: "bg-orange-100 text-orange-800" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const formatNumber = (n: number) =>
  new Intl.NumberFormat("id-ID").format(n);

export function MarketplaceReportsTab() {
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    marketplace: "tokopedia",
    report_month: new Date().getMonth() + 1,
    report_year: new Date().getFullYear(),
    total_orders: 0,
    total_revenue: 0,
    total_products_sold: 0,
    store_visitors: 0,
    conversion_rate: 0,
    avg_order_value: 0,
    notes: "",
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-marketplace"],
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

  const { data: reports, refetch } = useQuery({
    queryKey: ["marketplace-reports", selectedYear, selectedClientId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_reports")
        .select("*, clients(id, name)")
        .eq("report_year", selectedYear)
        .order("report_month", { ascending: true });

      if (selectedClientId !== "all") {
        query = query.eq("client_id", selectedClientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Chart data
  const chartData = MONTHS.map((month, idx) => {
    const monthReports = reports?.filter((r: any) => r.report_month === idx + 1) || [];
    const tokopedia = monthReports.find((r: any) => r.marketplace === "tokopedia");
    const shopee = monthReports.find((r: any) => r.marketplace === "shopee");
    return {
      month,
      tokopedia_revenue: tokopedia?.total_revenue || 0,
      shopee_revenue: shopee?.total_revenue || 0,
      tokopedia_orders: tokopedia?.total_orders || 0,
      shopee_orders: shopee?.total_orders || 0,
    };
  });

  const totalRevenue = reports?.reduce((sum: number, r: any) => sum + (r.total_revenue || 0), 0) || 0;
  const totalOrders = reports?.reduce((sum: number, r: any) => sum + (r.total_orders || 0), 0) || 0;
  const totalVisitors = reports?.reduce((sum: number, r: any) => sum + (r.store_visitors || 0), 0) || 0;

  const handleSave = async () => {
    if (!formData.client_id) {
      toast.error("Pilih client terlebih dahulu");
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("marketplace_reports").insert({
      ...formData,
      created_by: user?.user?.id,
    });

    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
      return;
    }

    toast.success("Report marketplace berhasil disimpan");
    setShowAddDialog(false);
    refetch();
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Client</SelectItem>
            {clients?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setShowAddDialog(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-2" /> Tambah Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <DollarSign className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-xl font-bold">{formatNumber(totalOrders)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Eye className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Visitors</p>
                <p className="text-xl font-bold">{formatNumber(totalVisitors)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Trend ({selectedYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="tokopedia_revenue" name="Tokopedia" fill="hsl(140, 60%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="shopee_revenue" name="Shopee" fill="hsl(25, 90%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Orders Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orders Trend ({selectedYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="tokopedia_orders" name="Tokopedia" stroke="hsl(140, 60%, 45%)" strokeWidth={2} />
              <Line type="monotone" dataKey="shopee_orders" name="Shopee" stroke="hsl(25, 90%, 55%)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Bulan</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Conv. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Belum ada data marketplace report
                    </TableCell>
                  </TableRow>
                ) : (
                  reports?.map((r: any) => {
                    const mp = MARKETPLACES.find(m => m.value === r.marketplace);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.clients?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={mp?.color}>
                            {mp?.label || r.marketplace}
                          </Badge>
                        </TableCell>
                        <TableCell>{MONTHS[r.report_month - 1]} {r.report_year}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_revenue || 0)}</TableCell>
                        <TableCell className="text-right">{formatNumber(r.total_orders || 0)}</TableCell>
                        <TableCell className="text-right">{formatNumber(r.store_visitors || 0)}</TableCell>
                        <TableCell className="text-right">{(r.conversion_rate || 0).toFixed(2)}%</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Marketplace Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marketplace</Label>
                <Select value={formData.marketplace} onValueChange={(v) => setFormData(p => ({ ...p, marketplace: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MARKETPLACES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Select value={String(formData.report_month)} onValueChange={(v) => setFormData(p => ({ ...p, report_month: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tahun</Label>
                <Input type="number" value={formData.report_year} onChange={(e) => setFormData(p => ({ ...p, report_year: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Revenue (Rp)</Label>
                <Input type="number" value={formData.total_revenue} onChange={(e) => setFormData(p => ({ ...p, total_revenue: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Total Orders</Label>
                <Input type="number" value={formData.total_orders} onChange={(e) => setFormData(p => ({ ...p, total_orders: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Store Visitors</Label>
                <Input type="number" value={formData.store_visitors} onChange={(e) => setFormData(p => ({ ...p, store_visitors: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Conversion Rate (%)</Label>
                <Input type="number" step="0.01" value={formData.conversion_rate} onChange={(e) => setFormData(p => ({ ...p, conversion_rate: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Products Sold</Label>
                <Input type="number" value={formData.total_products_sold} onChange={(e) => setFormData(p => ({ ...p, total_products_sold: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Avg Order Value (Rp)</Label>
                <Input type="number" value={formData.avg_order_value} onChange={(e) => setFormData(p => ({ ...p, avg_order_value: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Catatan tambahan..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
