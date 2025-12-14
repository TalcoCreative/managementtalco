import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  TrendingUp, 
  Users,
  Wallet
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

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function FinanceDashboard() {
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const yearStart = format(startOfYear(today), "yyyy-MM-dd");
  const yearEnd = format(endOfYear(today), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");

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

  // Calculate metrics
  const dailyExpenses = ledgerEntries
    ?.filter(e => e.type === "expense" && e.date === todayStr)
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0) || 0;

  const monthlyExpenses = ledgerEntries
    ?.filter(e => e.type === "expense" && e.date >= monthStart && e.date <= monthEnd)
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0) || 0;

  const yearlyExpenses = ledgerEntries
    ?.filter(e => e.type === "expense" && e.date >= yearStart && e.date <= yearEnd)
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0) || 0;

  const monthlyIncome = ledgerEntries
    ?.filter(e => e.type === "income" && e.date >= monthStart && e.date <= monthEnd)
    .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const yearlyIncome = ledgerEntries
    ?.filter(e => e.type === "income" && e.date >= yearStart && e.date <= yearEnd)
    .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const netCashflow = yearlyIncome - yearlyExpenses;

  const payrollExpenses = ledgerEntries
    ?.filter(e => e.type === "expense" && e.sub_type === "payroll" && e.date >= yearStart)
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0) || 0;

  const nonPayrollExpenses = yearlyExpenses - payrollExpenses;

  // Expense by category
  const expenseByCategory = ledgerEntries
    ?.filter(e => e.type === "expense" && e.date >= yearStart)
    .reduce((acc, e) => {
      const cat = e.sub_type || "other";
      acc[cat] = (acc[cat] || 0) + Math.abs(Number(e.amount));
      return acc;
    }, {} as Record<string, number>) || {};

  const categoryData = Object.entries(expenseByCategory).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  // Monthly expense trend (last 6 months)
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(today, 5 - i);
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");
    
    const expenses = ledgerEntries
      ?.filter(e => e.type === "expense" && e.date >= start && e.date <= end)
      .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0) || 0;
    
    const income = ledgerEntries
      ?.filter(e => e.type === "income" && e.date >= start && e.date <= end)
      .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

    return {
      month: format(date, "MMM"),
      expenses,
      income
    };
  });

  // Forecast (next 3 months)
  const forecast = Array.from({ length: 3 }, (_, i) => {
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(monthlyExpenses)}</div>
            <p className="text-xs text-muted-foreground">{format(today, "MMMM yyyy")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{formatCurrency(monthlyIncome)}</div>
            <p className="text-xs text-muted-foreground">{format(today, "MMMM yyyy")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Cashflow (YTD)</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netCashflow >= 0 ? "text-green-500" : "text-destructive"}`}>
              {formatCurrency(netCashflow)}
            </div>
            <p className="text-xs text-muted-foreground">{format(today, "yyyy")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll vs Non-Payroll */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Payroll vs Non-Payroll (YTD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Payroll</span>
                <span className="font-bold">{formatCurrency(payrollExpenses)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3">
                <div 
                  className="bg-primary h-3 rounded-full" 
                  style={{ width: `${yearlyExpenses > 0 ? (payrollExpenses / yearlyExpenses) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Non-Payroll</span>
                <span className="font-bold">{formatCurrency(nonPayrollExpenses)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3">
                <div 
                  className="bg-orange-500 h-3 rounded-full" 
                  style={{ width: `${yearlyExpenses > 0 ? (nonPayrollExpenses / yearlyExpenses) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense by Category (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10b981" />
              <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
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
