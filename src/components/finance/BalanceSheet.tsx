import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, Download, AlertCircle, CheckCircle } from "lucide-react";
import { format, endOfMonth, startOfYear } from "date-fns";
import { formatCurrency, getMonthNameID, isHPPCategory, getExpenseGroup } from "@/lib/accounting-utils";

export function BalanceSheet() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());

  // Generate year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);
  
  // Month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: getMonthNameID(i + 1),
  }));

  const asOfDate = endOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));
  const yearStartDate = startOfYear(asOfDate);

  // Fetch chart of accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch balance sheet items (manual adjustments)
  const { data: balanceItems, isLoading: balanceLoading } = useQuery({
    queryKey: ["balance-sheet-items", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balance_sheet_items")
        .select("*")
        .lte("as_of_date", format(asOfDate, "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch income (YTD for retained earnings calculation)
  const { data: income, isLoading: incomeLoading } = useQuery({
    queryKey: ["balance-sheet-income", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .gte("date", format(yearStartDate, "yyyy-MM-dd"))
        .lte("date", format(asOfDate, "yyyy-MM-dd"))
        .eq("status", "received");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch expenses (YTD for retained earnings calculation)
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["balance-sheet-expenses", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("paid_at", format(yearStartDate, "yyyy-MM-dd"))
        .lte("paid_at", format(asOfDate, "yyyy-MM-dd"))
        .eq("status", "paid");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payroll (YTD)
  const { data: payroll, isLoading: payrollLoading } = useQuery({
    queryKey: ["balance-sheet-payroll", selectedYear, selectedMonth],
    queryFn: async () => {
      const yearStart = format(yearStartDate, "yyyy-MM");
      const monthEnd = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;
      
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .gte("month", yearStart)
        .lte("month", monthEnd)
        .eq("status", "paid");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch pending income (receivables)
  const { data: pendingIncome } = useQuery({
    queryKey: ["balance-sheet-pending-income", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .lte("date", format(asOfDate, "yyyy-MM-dd"))
        .eq("status", "pending");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch pending payroll (liabilities)
  const { data: pendingPayroll } = useQuery({
    queryKey: ["balance-sheet-pending-payroll", selectedYear, selectedMonth],
    queryFn: async () => {
      const monthEnd = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;
      
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .lte("month", monthEnd)
        .in("status", ["draft", "final"]);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch pending expenses (payables)
  const { data: pendingExpenses } = useQuery({
    queryKey: ["balance-sheet-pending-expenses", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .lte("created_at", format(asOfDate, "yyyy-MM-dd"))
        .eq("status", "pending");
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate balance sheet
  const balanceSheet = useMemo(() => {
    // Calculate YTD profit
    const totalIncome = income?.reduce((sum, i) => sum + i.amount, 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const totalPayroll = payroll?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const ytdProfit = totalIncome - totalExpenses - totalPayroll;

    // Get balance items by account type
    const getBalanceByCode = (code: string) => {
      return balanceItems?.filter(b => {
        const account = accounts?.find(a => a.id === b.account_id);
        return account?.code === code;
      }).reduce((sum, b) => sum + Number(b.amount), 0) || 0;
    };

    // Assets
    const cashBank = getBalanceByCode("1110");
    const accountsReceivable = pendingIncome?.reduce((sum, i) => sum + i.amount, 0) || 0;
    const employeeReceivables = getBalanceByCode("1130");
    const prepaidExpenses = getBalanceByCode("1140");
    const totalCurrentAssets = cashBank + accountsReceivable + employeeReceivables + prepaidExpenses;

    const officeEquipment = getBalanceByCode("1210");
    const vehicles = getBalanceByCode("1220");
    const accumulatedDepreciation = getBalanceByCode("1230");
    const totalFixedAssets = officeEquipment + vehicles - accumulatedDepreciation;

    const totalAssets = totalCurrentAssets + totalFixedAssets;

    // Liabilities
    const accountsPayable = pendingExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const salaryPayable = pendingPayroll?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const taxPayable = getBalanceByCode("2130");
    const bpjsPayable = getBalanceByCode("2140");
    const totalCurrentLiabilities = accountsPayable + salaryPayable + taxPayable + bpjsPayable;

    const longTermLiabilities = getBalanceByCode("2200");
    const totalLiabilities = totalCurrentLiabilities + longTermLiabilities;

    // Equity
    const paidInCapital = getBalanceByCode("3100");
    const retainedEarnings = getBalanceByCode("3200");
    const currentYearProfit = ytdProfit;
    const totalEquity = paidInCapital + retainedEarnings + currentYearProfit;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    return {
      // Assets
      cashBank,
      accountsReceivable,
      employeeReceivables,
      prepaidExpenses,
      totalCurrentAssets,
      officeEquipment,
      vehicles,
      accumulatedDepreciation,
      totalFixedAssets,
      totalAssets,
      // Liabilities
      accountsPayable,
      salaryPayable,
      taxPayable,
      bpjsPayable,
      totalCurrentLiabilities,
      longTermLiabilities,
      totalLiabilities,
      // Equity
      paidInCapital,
      retainedEarnings,
      currentYearProfit,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
    };
  }, [accounts, balanceItems, income, expenses, payroll, pendingIncome, pendingPayroll, pendingExpenses]);

  const isLoading = accountsLoading || balanceLoading || incomeLoading || expensesLoading || payrollLoading;

  const BalanceRow = ({ 
    label, 
    amount, 
    isTotal = false, 
    isSubTotal = false,
    indent = 0,
    highlight = false,
  }: { 
    label: string; 
    amount: number; 
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
      <TableCell className={`text-right ${isTotal || isSubTotal ? "font-semibold" : ""} ${highlight ? "text-primary" : ""}`}>
        {formatCurrency(amount)}
      </TableCell>
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
              <label className="text-sm font-medium">Per Tanggal</label>
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

            <Badge 
              variant={balanceSheet.isBalanced ? "default" : "destructive"} 
              className="gap-1 h-9"
            >
              {balanceSheet.isBalanced ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Balance
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  Tidak Balance
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Balance Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Scale className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>ASET</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Per {format(asOfDate, "dd MMMM yyyy")}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <BalanceRow label="ASET LANCAR" amount={0} isSubTotal highlight />
                  <BalanceRow label="Kas & Bank" amount={balanceSheet.cashBank} indent={1} />
                  <BalanceRow label="Piutang Usaha" amount={balanceSheet.accountsReceivable} indent={1} />
                  <BalanceRow label="Piutang Karyawan" amount={balanceSheet.employeeReceivables} indent={1} />
                  <BalanceRow label="Uang Muka" amount={balanceSheet.prepaidExpenses} indent={1} />
                  <BalanceRow label="Total Aset Lancar" amount={balanceSheet.totalCurrentAssets} isSubTotal />

                  <BalanceRow label="ASET TETAP" amount={0} isSubTotal highlight />
                  <BalanceRow label="Peralatan Kantor" amount={balanceSheet.officeEquipment} indent={1} />
                  <BalanceRow label="Kendaraan" amount={balanceSheet.vehicles} indent={1} />
                  <BalanceRow label="Akumulasi Penyusutan" amount={-balanceSheet.accumulatedDepreciation} indent={1} />
                  <BalanceRow label="Total Aset Tetap" amount={balanceSheet.totalFixedAssets} isSubTotal />

                  <BalanceRow label="TOTAL ASET" amount={balanceSheet.totalAssets} isTotal highlight />
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Liabilities & Equity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Scale className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>KEWAJIBAN & MODAL</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Per {format(asOfDate, "dd MMMM yyyy")}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <BalanceRow label="KEWAJIBAN LANCAR" amount={0} isSubTotal highlight />
                  <BalanceRow label="Hutang Usaha" amount={balanceSheet.accountsPayable} indent={1} />
                  <BalanceRow label="Hutang Gaji" amount={balanceSheet.salaryPayable} indent={1} />
                  <BalanceRow label="Hutang Pajak" amount={balanceSheet.taxPayable} indent={1} />
                  <BalanceRow label="Hutang BPJS" amount={balanceSheet.bpjsPayable} indent={1} />
                  <BalanceRow label="Total Kewajiban Lancar" amount={balanceSheet.totalCurrentLiabilities} isSubTotal />

                  <BalanceRow label="KEWAJIBAN JANGKA PANJANG" amount={0} isSubTotal highlight />
                  <BalanceRow label="Hutang Jangka Panjang" amount={balanceSheet.longTermLiabilities} indent={1} />
                  <BalanceRow label="Total Kewajiban" amount={balanceSheet.totalLiabilities} isSubTotal />

                  <BalanceRow label="MODAL" amount={0} isSubTotal highlight />
                  <BalanceRow label="Modal Disetor" amount={balanceSheet.paidInCapital} indent={1} />
                  <BalanceRow label="Laba Ditahan" amount={balanceSheet.retainedEarnings} indent={1} />
                  <BalanceRow label="Laba Tahun Berjalan" amount={balanceSheet.currentYearProfit} indent={1} />
                  <BalanceRow label="Total Modal" amount={balanceSheet.totalEquity} isSubTotal />

                  <BalanceRow label="TOTAL KEWAJIBAN & MODAL" amount={balanceSheet.totalLiabilitiesAndEquity} isTotal highlight />
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
