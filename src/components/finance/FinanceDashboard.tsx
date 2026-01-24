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
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, addMonths } from "date-fns";
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
  getAllSubCategories
} from "@/lib/finance-categories";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function FinanceDashboard() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

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

  // Filter ledger entries based on selected filters
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
      
      // Category filter
      if (selectedCategory !== "all" && entry.sub_type !== selectedCategory) return false;
      
      // Sub-category filter
      if (selectedSubCategory !== "all" && entry.sub_category !== selectedSubCategory) return false;
      
      return true;
    });
  }, [ledgerEntries, selectedYear, selectedMonth, selectedCategory, selectedSubCategory]);

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

  const payrollExpenses = filteredEntries
    .filter(e => e.type === "expense" && (e.sub_type === "sdm_hr" || e.sub_category === "gaji_upah"))
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);

  const nonPayrollExpenses = totalExpenses - payrollExpenses;

  // Expense by main category
  const expenseByMainCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    
    filteredEntries
      .filter(e => e.type === "expense")
      .forEach(e => {
        const cat = e.sub_type || "lainnya";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(Number(e.amount));
      });
    
    return Object.entries(categoryTotals)
      .map(([value, amount]) => ({
        name: getMainCategoryLabel(value),
        value: amount
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries]);

  // Expense by sub-category (for selected main category or all)
  const expenseBySubCategory = useMemo(() => {
    const subCategoryTotals: Record<string, number> = {};
    
    filteredEntries
      .filter(e => e.type === "expense")
      .forEach(e => {
        const subCat = e.sub_category || "tidak_terklasifikasi";
        subCategoryTotals[subCat] = (subCategoryTotals[subCat] || 0) + Math.abs(Number(e.amount));
      });
    
    return Object.entries(subCategoryTotals)
      .map(([value, amount]) => {
        // Find the label for this sub-category
        const allSubs = getAllSubCategories();
        const subInfo = allSubs.find(s => s.value === value);
        return {
          name: subInfo?.label || value,
          value: amount
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10
  }, [filteredEntries]);

  // Monthly expense trend (last 6 months or filtered year)
  const monthlyTrend = useMemo(() => {
    const year = parseInt(selectedYear);
    const months = selectedMonth === "all" 
      ? Array.from({ length: 12 }, (_, i) => i)
      : [parseInt(selectedMonth)];
    
    if (selectedMonth !== "all") {
      // If specific month selected, show daily breakdown
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
    
    // Show monthly breakdown
    return months.map(month => {
      const startDate = new Date(year, month, 1);
      const start = format(startDate, "yyyy-MM-dd");
      const end = format(endOfMonth(startDate), "yyyy-MM-dd");
      
      const monthExpenses = ledgerEntries
        ?.filter(e => {
          if (e.type !== "expense") return false;
          if (e.date < start || e.date > end) return false;
          if (selectedCategory !== "all" && e.sub_type !== selectedCategory) return false;
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
      
      // Recurring expenses
      const recurringExpenses = recurringBudgets
        ?.filter(r => r.type === "expense")
        .reduce((sum, r) => {
          if (r.period === "monthly") return sum + Number(r.amount);
          if (r.period === "yearly") return sum + Number(r.amount) / 12;
          if (r.period === "weekly") return sum + Number(r.amount) * 4;
          return sum;
        }, 0) || 0;

      // Planned payroll
      const plannedPayroll = payrollData
        ?.filter(p => {
          const payMonth = new Date(p.month);
          return payMonth.getMonth() === date.getMonth() && payMonth.getFullYear() === date.getFullYear();
        })
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Recurring income
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Main Category</Label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>Sub-Category</Label>
              <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                <SelectTrigger>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Awal</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${previousBalance >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrency(previousBalance)}
            </div>
            <p className="text-xs text-muted-foreground">{previousPeriodLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-muted-foreground">{getFilterLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">{getFilterLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Cashflow</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netCashflow >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(netCashflow)}
            </div>
            <p className="text-xs text-muted-foreground">{getFilterLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Akhir</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${endingBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(endingBalance)}
            </div>
            <p className="text-xs text-muted-foreground">{getFilterLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Expenses</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(dailyExpenses)}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll vs Non-Payroll & Category Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Payroll vs Non-Payroll
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Payroll (SDM/HR)</span>
                <span className="font-bold">{formatCurrency(payrollExpenses)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3">
                <div 
                  className="bg-primary h-3 rounded-full" 
                  style={{ width: `${totalExpenses > 0 ? (payrollExpenses / totalExpenses) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Non-Payroll</span>
                <span className="font-bold">{formatCurrency(nonPayrollExpenses)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3">
                <div 
                  className="bg-orange-500 h-3 rounded-full" 
                  style={{ width: `${totalExpenses > 0 ? (nonPayrollExpenses / totalExpenses) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense by Main Category</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByMainCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={expenseByMainCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseByMainCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sub-Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Expense by Sub-Category</CardTitle>
        </CardHeader>
        <CardContent>
          {expenseBySubCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseBySubCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly/Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {selectedMonth !== "all" ? "Daily Trend" : "Monthly Trend"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={selectedMonth !== "all" ? "day" : "month"} />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10b981" />
                <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast (Next 3 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Expected Income" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" name="Expected Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
