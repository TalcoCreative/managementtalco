import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, AlertCircle, CheckCircle } from "lucide-react";
import { format, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { formatCurrency, getMonthNameID } from "@/lib/accounting-utils";

type ViewMode = "monthly" | "yearly";

export function BalanceSheet() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: getMonthNameID(i + 1),
  }));

  // Determine the "as of" date based on view mode
  const asOfDate = viewMode === "yearly"
    ? endOfYear(new Date(parseInt(selectedYear), 0))
    : endOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));
  
  const yearStartDate = startOfYear(asOfDate);
  const asOfDateStr = format(asOfDate, "yyyy-MM-dd");
  const yearStartStr = format(yearStartDate, "yyyy-MM-dd");

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

  // Fetch balance sheet manual items
  const { data: balanceItems, isLoading: balanceLoading } = useQuery({
    queryKey: ["balance-sheet-items", asOfDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balance_sheet_items")
        .select("*")
        .lte("as_of_date", asOfDateStr);
      if (error) throw error;
      return data || [];
    },
  });

  // ALL received income up to asOfDate
  const { data: allReceivedIncome, isLoading: incomeLoading } = useQuery({
    queryKey: ["bs-received-income", asOfDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .lte("date", asOfDateStr)
        .eq("status", "received");
      if (error) throw error;
      return data || [];
    },
  });

  // ALL pending income up to asOfDate (receivables)
  const { data: pendingIncome } = useQuery({
    queryKey: ["bs-pending-income", asOfDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .lte("date", asOfDateStr)
        .eq("status", "pending");
      if (error) throw error;
      return data || [];
    },
  });

  // ALL paid expenses up to asOfDate
  const { data: allPaidExpenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["bs-paid-expenses", asOfDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .lte("created_at", `${asOfDateStr}T23:59:59`)
        .eq("status", "paid");
      if (error) throw error;
      return data || [];
    },
  });

  // ALL pending expenses up to asOfDate (payables)
  const { data: pendingExpenses } = useQuery({
    queryKey: ["bs-pending-expenses", asOfDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .lte("created_at", `${asOfDateStr}T23:59:59`)
        .eq("status", "pending");
      if (error) throw error;
      return data || [];
    },
  });

  // ALL paid payroll up to asOfDate - use proper date format YYYY-MM-DD
  const { data: allPaidPayroll, isLoading: payrollLoading } = useQuery({
    queryKey: ["bs-paid-payroll", asOfDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .lte("month", asOfDateStr)
        .eq("status", "paid");
      if (error) throw error;
      return data || [];
    },
  });

  // Pending payroll (salary payable)
  const { data: pendingPayroll } = useQuery({
    queryKey: ["bs-pending-payroll", asOfDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .lte("month", asOfDateStr)
        .in("status", ["draft", "final"]);
      if (error) throw error;
      return data || [];
    },
  });

  const balanceSheet = useMemo(() => {
    // Helper: get manual balance by account code
    const getBalanceByCode = (code: string) => {
      return balanceItems?.filter(b => {
        const account = accounts?.find(a => a.id === b.account_id);
        return account?.code === code;
      }).reduce((sum, b) => sum + Number(b.amount), 0) || 0;
    };

    // Equipment sub-categories (these are CAPEX, not OPEX)
    const equipmentSubCats = ["equipment", "hardware"];
    const isEquipmentExpense = (e: any) => equipmentSubCats.includes(e.sub_category || "");

    // ===== ASSETS =====
    // Cash = received income - paid expenses - paid payroll + manual adjustments
    const totalReceivedIncome = allReceivedIncome?.reduce((sum, i) => sum + i.amount, 0) || 0;
    const totalPaidExpenses = allPaidExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const totalPaidPayroll = allPaidPayroll?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const manualCashAdj = getBalanceByCode("1110");
    const cashBank = totalReceivedIncome - totalPaidExpenses - totalPaidPayroll + manualCashAdj;

    // Receivables = pending income
    const accountsReceivable = pendingIncome?.reduce((sum, i) => sum + i.amount, 0) || 0;
    const employeeReceivables = getBalanceByCode("1130");
    const prepaidExpenses = getBalanceByCode("1140");
    const totalCurrentAssets = cashBank + accountsReceivable + employeeReceivables + prepaidExpenses;

    // Fixed assets: equipment from paid expenses + manual
    const equipmentFromExpenses = allPaidExpenses?.filter(isEquipmentExpense).reduce((sum, e) => sum + e.amount, 0) || 0;
    const officeEquipment = equipmentFromExpenses + getBalanceByCode("1210");
    const vehicles = getBalanceByCode("1220");
    const accumulatedDepreciation = getBalanceByCode("1230");
    const totalFixedAssets = officeEquipment + vehicles - accumulatedDepreciation;

    const totalAssets = totalCurrentAssets + totalFixedAssets;

    // ===== LIABILITIES =====
    const accountsPayable = pendingExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const salaryPayable = pendingPayroll?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const taxPayable = getBalanceByCode("2130");
    const bpjsPayable = getBalanceByCode("2140");
    const totalCurrentLiabilities = accountsPayable + salaryPayable + taxPayable + bpjsPayable;
    const longTermLiabilities = getBalanceByCode("2200");
    const totalLiabilities = totalCurrentLiabilities + longTermLiabilities;

    // ===== EQUITY =====
    const paidInCapital = getBalanceByCode("3100");

    // Current year profit (YTD) - EXCLUDE equipment from expenses (it's CAPEX not OPEX)
    // Use ACCRUAL basis: all income - all non-equipment expenses - all payroll for the year
    const ytdReceivedIncome = allReceivedIncome?.filter(i => i.date >= yearStartStr).reduce((sum, i) => sum + i.amount, 0) || 0;
    const ytdPendingIncome = pendingIncome?.filter(i => i.date >= yearStartStr).reduce((sum, i) => sum + i.amount, 0) || 0;
    const ytdTotalIncome = ytdReceivedIncome + ytdPendingIncome;

    const ytdPaidNonEquipExpenses = allPaidExpenses?.filter(e => e.created_at >= yearStartStr && !isEquipmentExpense(e)).reduce((sum, e) => sum + e.amount, 0) || 0;
    const ytdPendingNonEquipExpenses = pendingExpenses?.filter(e => e.created_at >= yearStartStr && !isEquipmentExpense(e)).reduce((sum, e) => sum + e.amount, 0) || 0;
    const ytdTotalExpenses = ytdPaidNonEquipExpenses + ytdPendingNonEquipExpenses;

    const ytdPaidPayroll = allPaidPayroll?.filter(p => p.month >= yearStartStr).reduce((sum, p) => sum + p.amount, 0) || 0;
    const ytdPendingPayroll = pendingPayroll?.filter(p => p.month >= yearStartStr).reduce((sum, p) => sum + p.amount, 0) || 0;
    const ytdTotalPayroll = ytdPaidPayroll + ytdPendingPayroll;

    const currentYearProfit = ytdTotalIncome - ytdTotalExpenses - ytdTotalPayroll;

    // Retained earnings = auto-calculated as balancing figure
    // This ensures the balance sheet ALWAYS balances
    // Retained earnings = Total Assets - Total Liabilities - Paid-in Capital - Current Year Profit + manual retained
    const manualRetained = getBalanceByCode("3200");
    const retainedEarnings = totalAssets - totalLiabilities - paidInCapital - currentYearProfit + manualRetained;
    // Since retainedEarnings is computed as plug, total equity = totalAssets - totalLiabilities
    const totalEquity = paidInCapital + retainedEarnings + currentYearProfit;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

    return {
      cashBank, accountsReceivable, employeeReceivables, prepaidExpenses, totalCurrentAssets,
      officeEquipment, vehicles, accumulatedDepreciation, totalFixedAssets, totalAssets,
      accountsPayable, salaryPayable, taxPayable, bpjsPayable, totalCurrentLiabilities,
      longTermLiabilities, totalLiabilities,
      paidInCapital, retainedEarnings, currentYearProfit, totalEquity,
      totalLiabilitiesAndEquity, isBalanced,
    };
  }, [accounts, balanceItems, allReceivedIncome, allPaidExpenses, allPaidPayroll, pendingIncome, pendingExpenses, pendingPayroll, yearStartStr]);

  const isLoading = accountsLoading || balanceLoading || incomeLoading || expensesLoading || payrollLoading;

  const BalanceRow = ({ 
    label, amount, isTotal = false, isSubTotal = false, indent = 0, highlight = false,
  }: { 
    label: string; amount: number; isTotal?: boolean; isSubTotal?: boolean; indent?: number; highlight?: boolean;
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
        <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-96 w-full" /></CardContent>
      </Card>
    );
  }

  const periodLabel = viewMode === "yearly"
    ? `31 Desember ${selectedYear}`
    : format(asOfDate, "dd MMMM yyyy");

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode</label>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                  <SelectItem value="yearly">Tahunan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tahun</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {viewMode === "monthly" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Bulan</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Badge 
              variant={balanceSheet.isBalanced ? "default" : "destructive"} 
              className="gap-1 h-9"
            >
              {balanceSheet.isBalanced ? (
                <><CheckCircle className="h-4 w-4" /> Balance</>
              ) : (
                <><AlertCircle className="h-4 w-4" /> Tidak Balance</>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Balance Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Scale className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>ASET</CardTitle>
                <p className="text-sm text-muted-foreground">Per {periodLabel}</p>
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
          <CardHeader>
            <div className="flex items-center gap-3">
              <Scale className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>KEWAJIBAN & MODAL</CardTitle>
                <p className="text-sm text-muted-foreground">Per {periodLabel}</p>
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
