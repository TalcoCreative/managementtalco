import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Briefcase, 
  PieChart,
  Clock,
  DollarSign,
  Target,
  AlertTriangle
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatCurrency, formatPercentage, calculateMargin, calculateCashRunway, getMonthNameID, isHPPCategory } from "@/lib/accounting-utils";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658", "#FF7300"];

export function FinanceInsights() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: getMonthNameID(i + 1),
  }));

  const startDate = startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));
  const endDate = endOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));

  // Fetch income with client/project info
  const { data: income, isLoading: incomeLoading } = useQuery({
    queryKey: ["insights-income", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select(`
          *,
          clients:client_id(id, name),
          projects:project_id(id, title)
        `)
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"))
        .eq("status", "received");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch expenses with client/project info
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["insights-expenses", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          clients:client_id(id, name),
          projects:project_id(id, title)
        `)
        .gte("paid_at", format(startDate, "yyyy-MM-dd"))
        .lte("paid_at", format(endDate, "yyyy-MM-dd"))
        .eq("status", "paid");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payroll
  const { data: payroll, isLoading: payrollLoading } = useQuery({
    queryKey: ["insights-payroll", selectedYear, selectedMonth],
    queryFn: async () => {
      const monthStr = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .eq("month", monthStr)
        .eq("status", "paid");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch balance for cash runway (last known cash balance)
  const { data: balanceItems } = useQuery({
    queryKey: ["insights-balance", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balance_sheet_items")
        .select(`
          *,
          account:account_id(code, name)
        `)
        .lte("as_of_date", format(endDate, "yyyy-MM-dd"))
        .order("as_of_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate insights
  const insights = useMemo(() => {
    const totalRevenue = income?.reduce((sum, i) => sum + i.amount, 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const totalPayroll = payroll?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalHPP = expenses?.filter(e => isHPPCategory(e.category, e.sub_category))
      .reduce((sum, e) => sum + e.amount, 0) || 0;

    // Client margin
    const clientData: Record<string, { revenue: number; cost: number; name: string }> = {};
    income?.forEach(i => {
      if (i.clients?.id) {
        if (!clientData[i.clients.id]) {
          clientData[i.clients.id] = { revenue: 0, cost: 0, name: i.clients.name || "Unknown" };
        }
        clientData[i.clients.id].revenue += i.amount;
      }
    });
    expenses?.forEach(e => {
      if (e.clients?.id && clientData[e.clients.id]) {
        clientData[e.clients.id].cost += e.amount;
      }
    });

    const clientMargins = Object.entries(clientData).map(([id, data]) => ({
      id,
      name: data.name,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      margin: calculateMargin(data.revenue, data.cost),
    })).sort((a, b) => b.revenue - a.revenue);

    // Project margin
    const projectData: Record<string, { revenue: number; cost: number; name: string }> = {};
    income?.forEach((i: any) => {
      if (i.projects?.id) {
        if (!projectData[i.projects.id]) {
          projectData[i.projects.id] = { revenue: 0, cost: 0, name: i.projects.title || "Unknown" };
        }
        projectData[i.projects.id].revenue += i.amount;
      }
    });
    expenses?.forEach((e: any) => {
      if (e.projects?.id && projectData[e.projects.id]) {
        projectData[e.projects.id].cost += e.amount;
      }
    });

    const projectMargins = Object.entries(projectData).map(([id, data]) => ({
      id,
      name: data.name,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      margin: calculateMargin(data.revenue, data.cost),
    })).sort((a, b) => b.revenue - a.revenue);

    // Key ratios
    const hppRatio = totalRevenue > 0 ? (totalHPP / totalRevenue) * 100 : 0;
    const sdmRatio = totalRevenue > 0 ? (totalPayroll / totalRevenue) * 100 : 0;
    const operatingMargin = calculateMargin(totalRevenue, totalExpenses + totalPayroll);
    
    // Cash runway
    const cashBalance = balanceItems?.find(b => b.account?.code === "1110")?.amount || 0;
    const monthlyBurn = totalExpenses + totalPayroll;
    const cashRunway = calculateCashRunway(Number(cashBalance), monthlyBurn);

    // Revenue by type for pie chart
    const revenueByType = income?.reduce((acc, i) => {
      const type = i.type || "other";
      acc[type] = (acc[type] || 0) + i.amount;
      return acc;
    }, {} as Record<string, number>) || {};

    const revenueChartData = Object.entries(revenueByType).map(([type, amount]) => ({
      name: type === "retainer" ? "Retainer" : type === "project" ? "Project" : type === "event" ? "Event" : "Lainnya",
      value: amount,
    }));

    return {
      totalRevenue,
      totalExpenses,
      totalPayroll,
      totalHPP,
      clientMargins: clientMargins.slice(0, 10),
      projectMargins: projectMargins.slice(0, 10),
      hppRatio,
      sdmRatio,
      operatingMargin,
      cashBalance: Number(cashBalance),
      cashRunway,
      revenueChartData,
    };
  }, [income, expenses, payroll, balanceItems]);

  const isLoading = incomeLoading || expensesLoading || payrollLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const InsightCard = ({ 
    title, 
    value, 
    subValue, 
    icon: Icon, 
    trend,
    warning = false,
  }: { 
    title: string; 
    value: string; 
    subValue?: string; 
    icon: any;
    trend?: "up" | "down" | "neutral";
    warning?: boolean;
  }) => (
    <Card className={warning ? "border-yellow-500" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subValue && <p className="text-sm text-muted-foreground">{subValue}</p>}
          </div>
          <div className={`p-3 rounded-full ${warning ? "bg-yellow-100 text-yellow-600" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend === "up" ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : trend === "down" ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tahun</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Bulan</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightCard 
          title="HPP vs Revenue" 
          value={formatPercentage(insights.hppRatio)}
          subValue="Harga Pokok Penjualan"
          icon={PieChart}
          warning={insights.hppRatio > 60}
        />
        <InsightCard 
          title="Beban SDM vs Revenue" 
          value={formatPercentage(insights.sdmRatio)}
          subValue="Total Payroll"
          icon={Users}
          warning={insights.sdmRatio > 40}
        />
        <InsightCard 
          title="Operating Margin" 
          value={formatPercentage(insights.operatingMargin)}
          subValue="Margin Operasional"
          icon={Target}
        />
        <InsightCard 
          title="Cash Runway" 
          value={`${insights.cashRunway} bulan`}
          subValue={formatCurrency(insights.cashBalance)}
          icon={Clock}
          warning={insights.cashRunway < 3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Komposisi Pendapatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={insights.revenueChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {insights.revenueChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Tidak ada data pendapatan
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Ratio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Rasio Pengeluaran
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>HPP vs Revenue</span>
                <span className={insights.hppRatio > 60 ? "text-yellow-600 font-medium" : ""}>
                  {formatPercentage(insights.hppRatio)}
                </span>
              </div>
              <Progress value={Math.min(insights.hppRatio, 100)} className="h-3" />
              <p className="text-xs text-muted-foreground">Target: &lt; 60%</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Beban SDM vs Revenue</span>
                <span className={insights.sdmRatio > 40 ? "text-yellow-600 font-medium" : ""}>
                  {formatPercentage(insights.sdmRatio)}
                </span>
              </div>
              <Progress value={Math.min(insights.sdmRatio, 100)} className="h-3" />
              <p className="text-xs text-muted-foreground">Target: &lt; 40%</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Operating Margin</span>
                <span className={insights.operatingMargin < 15 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                  {formatPercentage(insights.operatingMargin)}
                </span>
              </div>
              <Progress value={Math.min(Math.max(insights.operatingMargin, 0), 100)} className="h-3" />
              <p className="text-xs text-muted-foreground">Target: &gt; 15%</p>
            </div>

            {insights.cashRunway < 6 && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Cash Runway Rendah
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Sisa runway {insights.cashRunway} bulan. Disarankan minimal 6 bulan.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client & Project Margins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Margin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Margin per Klien
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.clientMargins.length > 0 ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Klien</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insights.clientMargins.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(client.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(client.cost)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={client.margin >= 30 ? "default" : client.margin >= 15 ? "secondary" : "destructive"}>
                            {formatPercentage(client.margin)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Tidak ada data klien</p>
            )}
          </CardContent>
        </Card>

        {/* Project Margin */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Margin per Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.projectMargins.length > 0 ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insights.projectMargins.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(project.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(project.cost)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={project.margin >= 30 ? "default" : project.margin >= 15 ? "secondary" : "destructive"}>
                            {formatPercentage(project.margin)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Tidak ada data project</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
