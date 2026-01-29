import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  TrendingUp, 
  Users,
  Wallet,
  Filter
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  FINANCE_CATEGORIES, 
  getMainCategoryLabel, 
  getSubCategoryLabel,
  getSubCategories,
  getAllSubCategories,
  findCategoryBySubCategory
} from "@/lib/finance-categories";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function FinanceDashboard() {
  const today = new Date();
  const currentYear = today.getFullYear();

  // Filters
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState("all");

  // Generate year options (current year and 2 previous)
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(y => y.toString());
  
  // Generate month options
  const monthOptions = [
    { value: "all", label: "All Months" },
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" },
  ];

  // Fetch ledger entries for calculations
  const { data: ledgerEntries } = useQuery({
    queryKey: ["finance-ledger-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .order("date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recurring budgets for forecast
  const { data: recurringBudgets } = useQuery({
    queryKey: ["finance-recurring-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_budget")
        .select("*")
        .eq("status", "active");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payroll for forecast
  const { data: payrollData } = useQuery({
    queryKey: ["finance-payroll-planned"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*, profiles(full_name)")
        .eq("status", "planned");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get available sub-categories based on selected main category
  const availableSubCategories = useMemo(() => {
    if (selectedCategory === "all") {
      return getAllSubCategories();
    }
    return getSubCategories(selectedCategory);
  }, [selectedCategory]);

  // Reset sub-category when main category changes
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedSubCategory("all");
  };

  // Calculate date range for selected period
  const periodDateRange = useMemo(() => {
    const year = parseInt(selectedYear);
    if (selectedMonth === "all") {
      return {
        start: format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd"),
        end: format(endOfYear(new Date(year, 11, 31)), "yyyy-MM-dd")
      };
    }
    const month = parseInt(selectedMonth);
    const startDate = new Date(year, month, 1);
    return {
      start: format(startOfMonth(startDate), "yyyy-MM-dd"),
      end: format(endOfMonth(startDate), "yyyy-MM-dd")
    };
  }, [selectedYear, selectedMonth]);

  // Helper to derive main category from sub_category for filtering
  const deriveMainCategory = (subCategory: string | null): string => {
    if (!subCategory) return "lainnya";
    const mainCat = findCategoryBySubCategory(subCategory);
    return mainCat?.value || "lainnya";
  };

  // SDM/HR sub-categories for payroll detection
  const sdmSubCategories = ["gaji_upah", "freelance_parttimer", "bpjs", "thr_bonus", "rekrutmen", "training_sertifikasi", "kesehatan_karyawan", "reimburse_karyawan"];

  // Filter ledger entries based on selected filters (for summary cards)
  const filteredEntries = useMemo(() => {
    if (!ledgerEntries) return [];
    
    return ledgerEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      const entryYear = entryDate.getFullYear();
      const entryMonth = entryDate.getMonth();
      
      // Year filter
      if (entryYear.toString() !== selectedYear) return false;
      
      // Month filter
      if (selectedMonth !== "all" && entryMonth !== parseInt(selectedMonth)) return false;
      
      // Category filter - derive from sub_category instead of unreliable sub_type
      if (selectedCategory !== "all") {
        const derivedCategory = deriveMainCategory(entry.sub_category);
        if (derivedCategory !== selectedCategory) return false;
      }
      
      // Sub-category filter
      if (selectedSubCategory !== "all" && entry.sub_category !== selectedSubCategory) return false;
      
      return true;
    });
  }, [ledgerEntries, selectedYear, selectedMonth, selectedCategory, selectedSubCategory]);

  // Base filtered entries (only year/month, no category filter) for charts
  const baseFilteredEntries = useMemo(() => {
    if (!ledgerEntries) return [];
    
    return ledgerEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      const entryYear = entryDate.getFullYear();
      const entryMonth = entryDate.getMonth();
      
      // Year filter
      if (entryYear.toString() !== selectedYear) return false;
      
      // Month filter
      if (selectedMonth !== "all" && entryMonth !== parseInt(selectedMonth)) return false;
      
      return true;
    });
  }, [ledgerEntries, selectedYear, selectedMonth]);

  // Calculate previous balance (all transactions before selected period)
  const previousBalance = useMemo(() => {
    if (!ledgerEntries) return 0;
    
    return ledgerEntries
      .filter(entry => entry.date < periodDateRange.start)
      .reduce((sum, entry) => {
        if (entry.type === "income") {
          return sum + Number(entry.amount);
        } else {
          return sum - Math.abs(Number(entry.amount));
        }
      }, 0);
  }, [ledgerEntries, periodDateRange.start]);

  // Get previous period label
  const previousPeriodLabel = useMemo(() => {
    const year = parseInt(selectedYear);
    if (selectedMonth === "all") {
      return `s/d ${year - 1}`;
    }
    const month = parseInt(selectedMonth);
    if (month === 0) {
      return `s/d Dec ${year - 1}`;
    }
    const prevMonth = new Date(year, month - 1, 1);
    return `s/d ${format(prevMonth, "MMM yyyy")}`;
  }, [selectedYear, selectedMonth]);

  // Calculate metrics from filtered entries
  const todayStr = format(today, "yyyy-MM-dd");
  
  const dailyExpenses = filteredEntries
    .filter(e => e.type === "expense" && e.date === todayStr)
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);

  const totalExpenses = filteredEntries
    .filter(e => e.type === "expense")
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);

  const totalIncome = filteredEntries
    .filter(e => e.type === "income")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const netCashflow = totalIncome - totalExpenses;
  const endingBalance = previousBalance + netCashflow;

  // Payroll calculations from BASE filtered entries (respects year/month only)
  const payrollExpenses = baseFilteredEntries
    .filter(e => e.type === "expense" && sdmSubCategories.includes(e.sub_category || ""))
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);

  const baseTotalExpenses = baseFilteredEntries
    .filter(e => e.type === "expense")
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);

  const nonPayrollExpenses = baseTotalExpenses - payrollExpenses;

  // Expense by main category - from BASE filtered entries (respects year/month only)
  const expenseByMainCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    
    baseFilteredEntries
      .filter(e => e.type === "expense")
      .forEach(e => {
        const mainCat = deriveMainCategory(e.sub_category);
        categoryTotals[mainCat] = (categoryTotals[mainCat] || 0) + Math.abs(Number(e.amount));
      });
    
    return Object.entries(categoryTotals)
      .map(([value, amount]) => ({
        name: getMainCategoryLabel(value),
        value: amount
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [baseFilteredEntries]);

  // Expense by sub-category - from BASE filtered entries (respects year/month only)
  const expenseBySubCategory = useMemo(() => {
    const subCategoryTotals: Record<string, number> = {};
    
    baseFilteredEntries
      .filter(e => e.type === "expense")
      .forEach(e => {
        const subCat = e.sub_category || "tidak_terklasifikasi";
        subCategoryTotals[subCat] = (subCategoryTotals[subCat] || 0) + Math.abs(Number(e.amount));
      });
    
    return Object.entries(subCategoryTotals)
      .map(([value, amount]) => {
        const allSubs = getAllSubCategories();
        const subInfo = allSubs.find(s => s.value === value);
        return {
          name: subInfo?.label || value,
          value: amount
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [baseFilteredEntries]);

  // Monthly expense trend (last 6 months or filtered year)
  const monthlyTrend = useMemo(() => {
    const year = parseInt(selectedYear);
    const months = selectedMonth === "all" 
      ? Array.from({ length: 12 }, (_, i) => i)
      : [parseInt(selectedMonth)];
    
    if (selectedMonth !== "all") {
      const month = parseInt(selectedMonth);
      const startDate = new Date(year, month, 1);
      const endDate = endOfMonth(startDate);
      const days: { day: string; expenses: number; income: number }[] = [];
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, "yyyy-MM-dd");
        
        const dayExpenses = filteredEntries
          .filter(e => e.type === "expense" && e.date === dateStr)
          .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
        
        const dayIncome = filteredEntries
          .filter(e => e.type === "income" && e.date === dateStr)
          .reduce((sum, e) => sum + Number(e.amount), 0);
        
        days.push({
          day: format(d, "dd"),
          expenses: dayExpenses,
          income: dayIncome
        });
      }
      
      return days;
    }
    
    return months.map(month => {
      const startDate = new Date(year, month, 1);
      const start = format(startDate, "yyyy-MM-dd");
      const end = format(endOfMonth(startDate), "yyyy-MM-dd");
      
      const monthExpenses = ledgerEntries
        ?.filter(e => {
          if (e.type !== "expense") return false;
          if (e.date < start || e.date > end) return false;
          if (selectedCategory !== "all") {
            const derivedCat = deriveMainCategory(e.sub_category);
            if (derivedCat !== selectedCategory) return false;
          }
          if (selectedSubCategory !== "all" && e.sub_category !== selectedSubCategory) return false;
          return true;
        })
        .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0) || 0;
      
      const monthIncome = ledgerEntries
        ?.filter(e => {
          if (e.type !== "income") return false;
          if (e.date < start || e.date > end) return false;
          return true;
        })
        .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      return {
        month: format(startDate, "MMM"),
        expenses: monthExpenses,
        income: monthIncome
      };
    });
  }, [ledgerEntries, selectedYear, selectedMonth, selectedCategory, selectedSubCategory, filteredEntries]);

  // Forecast (next 3 months)
  const forecast = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => {
      const date = addMonths(today, i + 1);
      
      const recurringExpenses = recurringBudgets
        ?.filter(r => r.type === "expense")
        .reduce((sum, r) => {
          if (r.period === "monthly") return sum + Number(r.amount);
          if (r.period === "yearly") return sum + Number(r.amount) / 12;
          if (r.period === "weekly") return sum + Number(r.amount) * 4;
          return sum;
        }, 0) || 0;

      const plannedPayroll = payrollData
        ?.filter(p => {
          const payMonth = new Date(p.month);
          return payMonth.getMonth() === date.getMonth() && payMonth.getFullYear() === date.getFullYear();
        })
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const recurringIncome = recurringBudgets
        ?.filter(r => r.type === "income")
        .reduce((sum, r) => {
          if (r.period === "monthly") return sum + Number(r.amount);
          if (r.period === "yearly") return sum + Number(r.amount) / 12;
          if (r.period === "weekly") return sum + Number(r.amount) * 4;
          return sum;
        }, 0) || 0;

      return {
        month: format(date, "MMM yyyy"),
        expenses: recurringExpenses + plannedPayroll,
        income: recurringIncome
      };
    });
  }, [today, recurringBudgets, payrollData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (Math.abs(value) >= 1000000000) {
      return `Rp ${(value / 1000000000).toFixed(1)}B`;
    }
    if (Math.abs(value) >= 1000000) {
      return `Rp ${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `Rp ${(value / 1000).toFixed(0)}K`;
    }
    return `Rp ${value}`;
  };

  const getFilterLabel = () => {
    let label = selectedYear;
    if (selectedMonth !== "all") {
      const monthInfo = monthOptions.find(m => m.value === selectedMonth);
      label = `${monthInfo?.label} ${selectedYear}`;
    }
    if (selectedCategory !== "all") {
      label += ` - ${getMainCategoryLabel(selectedCategory)}`;
    }
    if (selectedSubCategory !== "all") {
      const subInfo = availableSubCategories.find(s => s.value === selectedSubCategory);
      label += ` > ${subInfo?.label || selectedSubCategory}`;
    }
    return label;
  };

  const getPeriodLabel = () => {
    if (selectedMonth === "all") {
      return selectedYear;
    }
    const monthInfo = monthOptions.find(m => m.value === selectedMonth);
    return `${monthInfo?.label} ${selectedYear}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Main Category</Label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {FINANCE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sub-Category</Label>
              <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Categories</SelectItem>
                  {availableSubCategories.map(sub => (
                    <SelectItem key={sub.value} value={sub.value}>{sub.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Saldo Awal</CardTitle>
            <Wallet className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent className="pb-3 px-3">
            <div className={`text-lg font-bold truncate ${previousBalance >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrencyShort(previousBalance)}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{previousPeriodLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Total Income</CardTitle>
            <ArrowUpCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          </CardHeader>
          <CardContent className="pb-3 px-3">
            <div className="text-lg font-bold text-green-600 truncate">{formatCurrencyShort(totalIncome)}</div>
            <p className="text-[10px] text-muted-foreground truncate">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Total Expenses</CardTitle>
            <ArrowDownCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          </CardHeader>
          <CardContent className="pb-3 px-3">
            <div className="text-lg font-bold text-destructive truncate">{formatCurrencyShort(totalExpenses)}</div>
            <p className="text-[10px] text-muted-foreground truncate">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Net Cashflow</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          </CardHeader>
          <CardContent className="pb-3 px-3">
            <div className={`text-lg font-bold truncate ${netCashflow >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrencyShort(netCashflow)}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Saldo Akhir</CardTitle>
            <Wallet className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          </CardHeader>
          <CardContent className="pb-3 px-3">
            <div className={`text-lg font-bold truncate ${endingBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrencyShort(endingBalance)}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Daily Expenses</CardTitle>
            <ArrowDownCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          </CardHeader>
          <CardContent className="pb-3 px-3">
            <div className="text-lg font-bold text-destructive truncate">{formatCurrencyShort(dailyExpenses)}</div>
            <p className="text-[10px] text-muted-foreground">Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll vs Non-Payroll & Category Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Payroll vs Non-Payroll
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                {getPeriodLabel()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payroll (SDM/HR)</span>
                <span className="font-semibold">{formatCurrencyShort(payrollExpenses)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all" 
                  style={{ width: `${baseTotalExpenses > 0 ? (payrollExpenses / baseTotalExpenses) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Non-Payroll</span>
                <span className="font-semibold">{formatCurrencyShort(nonPayrollExpenses)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div 
                  className="bg-orange-500 h-2.5 rounded-full transition-all" 
                  style={{ width: `${baseTotalExpenses > 0 ? (nonPayrollExpenses / baseTotalExpenses) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total</span>
                <span className="font-bold">{formatCurrencyShort(baseTotalExpenses)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Expense by Main Category</span>
              <span className="text-xs font-normal text-muted-foreground">
                {getPeriodLabel()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByMainCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={expenseByMainCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseByMainCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sub-Category Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Top 10 Expense by Sub-Category</span>
            <span className="text-xs font-normal text-muted-foreground">
              {getPeriodLabel()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenseBySubCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseBySubCategory} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120} 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => value.length > 18 ? `${value.slice(0, 18)}...` : value}
                />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly/Daily Trend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            {selectedMonth !== "all" ? "Daily Trend" : "Monthly Trend"}
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {getFilterLabel()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={selectedMonth !== "all" ? "day" : "month"} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forecast */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Forecast (Next 3 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="income" name="Expected Income" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="expenses" name="Expected Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
