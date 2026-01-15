import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, TrendingUp, TrendingDown, Minus, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatCurrency, getExpenseGroup, isHPPCategory, calculateMargin, calculateChange, getMonthNameID } from "@/lib/accounting-utils";

export function IncomeStatement() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [compareMode, setCompareMode] = useState(false);

  // Generate year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);
  
  // Month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: getMonthNameID(i + 1),
  }));

  // Calculate date range
  const startDate = startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));
  const endDate = endOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));
  
  // Previous month for comparison
  const prevStartDate = startOfMonth(subMonths(startDate, 1));
  const prevEndDate = endOfMonth(subMonths(startDate, 1));

  // Fetch income data
  const { data: income, isLoading: incomeLoading } = useQuery({
    queryKey: ["income-statement-income", selectedYear, selectedMonth, selectedClient, selectedProject],
    queryFn: async () => {
      let query = supabase
        .from("income")
        .select("*")
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"))
        .eq("status", "received");

      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }
      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch previous month income for comparison
  const { data: prevIncome } = useQuery({
    queryKey: ["income-statement-income-prev", selectedYear, selectedMonth, selectedClient, selectedProject],
    queryFn: async () => {
      if (!compareMode) return [];
      
      let query = supabase
        .from("income")
        .select("*")
        .gte("date", format(prevStartDate, "yyyy-MM-dd"))
        .lte("date", format(prevEndDate, "yyyy-MM-dd"))
        .eq("status", "received");

      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }
      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: compareMode,
  });

  // Fetch expenses data - use created_at for date filtering since paid_at might be null initially
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["income-statement-expenses", selectedYear, selectedMonth, selectedClient, selectedProject],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("*")
        .gte("created_at", format(startDate, "yyyy-MM-dd"))
        .lte("created_at", format(endDate, "yyyy-MM-dd'T'23:59:59"))
        .eq("status", "paid");

      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }
      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch previous month expenses for comparison
  const { data: prevExpenses } = useQuery({
    queryKey: ["income-statement-expenses-prev", selectedYear, selectedMonth, selectedClient, selectedProject],
    queryFn: async () => {
      if (!compareMode) return [];
      
      let query = supabase
        .from("expenses")
        .select("*")
        .gte("created_at", format(prevStartDate, "yyyy-MM-dd"))
        .lte("created_at", format(prevEndDate, "yyyy-MM-dd'T'23:59:59"))
        .eq("status", "paid");

      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }
      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: compareMode,
  });

  // Fetch payroll data
  const { data: payroll, isLoading: payrollLoading } = useQuery({
    queryKey: ["income-statement-payroll", selectedYear, selectedMonth],
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

  // Fetch previous month payroll
  const { data: prevPayroll } = useQuery({
    queryKey: ["income-statement-payroll-prev", selectedYear, selectedMonth],
    queryFn: async () => {
      if (!compareMode) return [];
      
      const prevMonth = subMonths(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1), 1);
      const monthStr = format(prevMonth, "yyyy-MM");
      
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .eq("month", monthStr)
        .eq("status", "paid");

      if (error) throw error;
      return data || [];
    },
    enabled: compareMode,
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["projects-filter", selectedClient],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("id, title")
        .order("title");
      
      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate income statement values
  const statement = useMemo(() => {
    // Revenue
    const mainRevenue = income?.filter(i => ["retainer", "project", "event"].includes(i.type))
      .reduce((sum, i) => sum + i.amount, 0) || 0;
    const otherRevenue = income?.filter(i => !["retainer", "project", "event"].includes(i.type))
      .reduce((sum, i) => sum + i.amount, 0) || 0;
    const totalRevenue = mainRevenue + otherRevenue;

    // HPP (Cost of Goods Sold)
    const hppExpenses = expenses?.filter(e => isHPPCategory(e.category, e.sub_category))
      .reduce((sum, e) => sum + e.amount, 0) || 0;
    const grossProfit = totalRevenue - hppExpenses;

    // Operating Expenses by category
    const nonHppExpenses = expenses?.filter(e => !isHPPCategory(e.category, e.sub_category)) || [];
    
    const sdmExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "sdm")
      .reduce((sum, e) => sum + e.amount, 0);
    const payrollTotal = payroll?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalSdmExpenses = sdmExpenses + payrollTotal;
    
    const marketingExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "marketing")
      .reduce((sum, e) => sum + e.amount, 0);
    
    const itExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "it")
      .reduce((sum, e) => sum + e.amount, 0);
    
    const adminExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "administrasi")
      .reduce((sum, e) => sum + e.amount, 0);
    
    const otherExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "other")
      .reduce((sum, e) => sum + e.amount, 0);

    const totalOperatingExpenses = totalSdmExpenses + marketingExpenses + itExpenses + adminExpenses + otherExpenses;
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const netProfit = operatingProfit;

    // Margins
    const grossMargin = calculateMargin(totalRevenue, hppExpenses);
    const operatingMargin = calculateMargin(totalRevenue, totalRevenue - operatingProfit);
    const netMargin = calculateMargin(totalRevenue, totalRevenue - netProfit);

    return {
      mainRevenue,
      otherRevenue,
      totalRevenue,
      hppExpenses,
      grossProfit,
      totalSdmExpenses,
      marketingExpenses,
      itExpenses,
      adminExpenses,
      otherExpenses,
      totalOperatingExpenses,
      operatingProfit,
      netProfit,
      grossMargin,
      operatingMargin,
      netMargin,
    };
  }, [income, expenses, payroll]);

  // Calculate previous month statement for comparison
  const prevStatement = useMemo(() => {
    if (!compareMode) return null;

    const mainRevenue = prevIncome?.filter(i => ["retainer", "project", "event"].includes(i.type))
      .reduce((sum, i) => sum + i.amount, 0) || 0;
    const otherRevenue = prevIncome?.filter(i => !["retainer", "project", "event"].includes(i.type))
      .reduce((sum, i) => sum + i.amount, 0) || 0;
    const totalRevenue = mainRevenue + otherRevenue;

    const hppExpenses = prevExpenses?.filter(e => isHPPCategory(e.category, e.sub_category))
      .reduce((sum, e) => sum + e.amount, 0) || 0;
    const grossProfit = totalRevenue - hppExpenses;

    const nonHppExpenses = prevExpenses?.filter(e => !isHPPCategory(e.category, e.sub_category)) || [];
    
    const sdmExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "sdm")
      .reduce((sum, e) => sum + e.amount, 0);
    const payrollTotal = prevPayroll?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalSdmExpenses = sdmExpenses + payrollTotal;
    
    const marketingExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "marketing")
      .reduce((sum, e) => sum + e.amount, 0);
    
    const itExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "it")
      .reduce((sum, e) => sum + e.amount, 0);
    
    const adminExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "administrasi")
      .reduce((sum, e) => sum + e.amount, 0);
    
    const otherExpenses = nonHppExpenses.filter(e => getExpenseGroup(e.category, e.sub_category) === "other")
      .reduce((sum, e) => sum + e.amount, 0);

    const totalOperatingExpenses = totalSdmExpenses + marketingExpenses + itExpenses + adminExpenses + otherExpenses;
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const netProfit = operatingProfit;

    return {
      mainRevenue,
      otherRevenue,
      totalRevenue,
      hppExpenses,
      grossProfit,
      totalSdmExpenses,
      marketingExpenses,
      itExpenses,
      adminExpenses,
      otherExpenses,
      totalOperatingExpenses,
      operatingProfit,
      netProfit,
    };
  }, [compareMode, prevIncome, prevExpenses, prevPayroll]);

  const isLoading = incomeLoading || expensesLoading || payrollLoading;

  const renderChangeIndicator = (current: number, previous: number | undefined) => {
    if (!compareMode || previous === undefined) return null;
    
    const change = calculateChange(current, previous);
    const isPositive = change > 0;
    const isNeutral = change === 0;
    
    return (
      <span className={`text-xs flex items-center gap-1 ${isPositive ? "text-green-600" : isNeutral ? "text-muted-foreground" : "text-red-600"}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : isNeutral ? <Minus className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {change.toFixed(1)}%
      </span>
    );
  };

  const StatementRow = ({ 
    label, 
    amount, 
    prevAmount,
    isTotal = false, 
    isSubTotal = false,
    indent = 0,
    highlight = false,
  }: { 
    label: string; 
    amount: number; 
    prevAmount?: number;
    isTotal?: boolean; 
    isSubTotal?: boolean;
    indent?: number;
    highlight?: boolean;
  }) => (
    <TableRow className={highlight ? "bg-muted/50" : ""}>
      <TableCell 
        className={`${isTotal || isSubTotal ? "font-semibold" : ""}`}
        style={{ paddingLeft: `${1 + indent * 1.5}rem` }}
      >
        {label}
      </TableCell>
      {compareMode && (
        <TableCell className="text-right text-muted-foreground">
          {prevAmount !== undefined ? formatCurrency(prevAmount) : "-"}
        </TableCell>
      )}
      <TableCell className={`text-right ${isTotal || isSubTotal ? "font-semibold" : ""} ${highlight ? "text-primary" : ""}`}>
        {formatCurrency(amount)}
      </TableCell>
      {compareMode && (
        <TableCell className="text-right">
          {renderChangeIndicator(amount, prevAmount)}
        </TableCell>
      )}
    </TableRow>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

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
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Klien</label>
              <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedProject("all"); }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Semua Klien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Klien</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Semua Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Project</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              variant={compareMode ? "default" : "outline"}
              onClick={() => setCompareMode(!compareMode)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Bandingkan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Income Statement */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Laporan Laba Rugi</CardTitle>
              <p className="text-sm text-muted-foreground">
                Periode: {getMonthNameID(parseInt(selectedMonth))} {selectedYear}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Pendapatan</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(statement.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Laba Kotor</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(statement.grossProfit)}</p>
                <Badge variant="secondary" className="mt-1">{statement.grossMargin.toFixed(1)}%</Badge>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950/20">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Laba Operasional</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(statement.operatingProfit)}</p>
                <Badge variant="secondary" className="mt-1">{statement.operatingMargin.toFixed(1)}%</Badge>
              </CardContent>
            </Card>
            <Card className={statement.netProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"}>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Laba Bersih</p>
                <p className={`text-2xl font-bold ${statement.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(statement.netProfit)}
                </p>
                <Badge variant="secondary" className="mt-1">{statement.netMargin.toFixed(1)}%</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Statement Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2">Keterangan</TableHead>
                  {compareMode && (
                    <TableHead className="text-right">{getMonthNameID(parseInt(selectedMonth) - 1 || 12)} (Sebelum)</TableHead>
                  )}
                  <TableHead className="text-right">{getMonthNameID(parseInt(selectedMonth))} (Saat Ini)</TableHead>
                  {compareMode && <TableHead className="text-right w-24">Perubahan</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Revenue Section */}
                <StatementRow label="PENDAPATAN" amount={0} isSubTotal highlight />
                <StatementRow label="Pendapatan Utama" amount={statement.mainRevenue} prevAmount={prevStatement?.mainRevenue} indent={1} />
                <StatementRow label="Pendapatan Lain-lain" amount={statement.otherRevenue} prevAmount={prevStatement?.otherRevenue} indent={1} />
                <StatementRow label="Total Pendapatan" amount={statement.totalRevenue} prevAmount={prevStatement?.totalRevenue} isSubTotal />

                {/* HPP Section */}
                <StatementRow label="HARGA POKOK PENJUALAN (HPP)" amount={0} isSubTotal highlight />
                <StatementRow label="Biaya Produksi & Project" amount={statement.hppExpenses} prevAmount={prevStatement?.hppExpenses} indent={1} />
                <StatementRow label="Total HPP" amount={statement.hppExpenses} prevAmount={prevStatement?.hppExpenses} isSubTotal />

                {/* Gross Profit */}
                <StatementRow label="LABA KOTOR" amount={statement.grossProfit} prevAmount={prevStatement?.grossProfit} isTotal highlight />

                {/* Operating Expenses */}
                <StatementRow label="BEBAN OPERASIONAL" amount={0} isSubTotal highlight />
                <StatementRow label="Beban SDM" amount={statement.totalSdmExpenses} prevAmount={prevStatement?.totalSdmExpenses} indent={1} />
                <StatementRow label="Beban Marketing" amount={statement.marketingExpenses} prevAmount={prevStatement?.marketingExpenses} indent={1} />
                <StatementRow label="Beban IT & Tools" amount={statement.itExpenses} prevAmount={prevStatement?.itExpenses} indent={1} />
                <StatementRow label="Beban Administrasi" amount={statement.adminExpenses} prevAmount={prevStatement?.adminExpenses} indent={1} />
                <StatementRow label="Beban Lainnya" amount={statement.otherExpenses} prevAmount={prevStatement?.otherExpenses} indent={1} />
                <StatementRow label="Total Beban Operasional" amount={statement.totalOperatingExpenses} prevAmount={prevStatement?.totalOperatingExpenses} isSubTotal />

                {/* Operating Profit */}
                <StatementRow label="LABA OPERASIONAL" amount={statement.operatingProfit} prevAmount={prevStatement?.operatingProfit} isTotal highlight />

                {/* Net Profit */}
                <StatementRow label="LABA BERSIH" amount={statement.netProfit} prevAmount={prevStatement?.netProfit} isTotal highlight />
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
