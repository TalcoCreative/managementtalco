import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Receipt, Wallet, PiggyBank } from "lucide-react";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface PerformanceOverviewProps {
  payrollData: any[];
  reimbursements: any[];
  ledgerEntries: any[];
  profiles: any[];
  selectedMonth: string;
  filterByMonth: (date: string | null) => boolean;
}

const COLORS = ['hsl(250, 80%, 60%)', 'hsl(270, 85%, 65%)', 'hsl(142, 76%, 36%)', 'hsl(25, 95%, 53%)', 'hsl(217, 91%, 60%)'];

export function PerformanceOverview({
  payrollData,
  reimbursements,
  ledgerEntries,
  profiles,
  selectedMonth,
  filterByMonth,
}: PerformanceOverviewProps) {
  // Filter data by month
  const filteredPayroll = useMemo(() => {
    return payrollData.filter(p => filterByMonth(p.month));
  }, [payrollData, filterByMonth]);

  const filteredReimbursements = useMemo(() => {
    return reimbursements.filter(r => filterByMonth(r.created_at) && r.status === 'paid');
  }, [reimbursements, filterByMonth]);

  const filteredLedger = useMemo(() => {
    return ledgerEntries.filter(l => filterByMonth(l.date));
  }, [ledgerEntries, filterByMonth]);

  // Calculate metrics
  const totalPayroll = useMemo(() => {
    return filteredPayroll
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [filteredPayroll]);

  const totalReimbursements = useMemo(() => {
    return filteredReimbursements.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [filteredReimbursements]);

  const totalExpenses = useMemo(() => {
    return filteredLedger
      .filter(l => l.type === 'expense')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);
  }, [filteredLedger]);

  const totalIncome = useMemo(() => {
    return filteredLedger
      .filter(l => l.type === 'income')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);
  }, [filteredLedger]);

  const activeEmployees = profiles.filter(p => p.status === 'active').length;
  const costPerEmployee = activeEmployees > 0 ? (totalPayroll + totalReimbursements) / activeEmployees : 0;

  // Pie chart data for expense breakdown
  const expenseBreakdown = [
    { name: 'Payroll', value: totalPayroll },
    { name: 'Reimbursement', value: totalReimbursements },
    { name: 'Lainnya', value: Math.max(0, totalExpenses - totalPayroll - totalReimbursements) },
  ].filter(d => d.value > 0);

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, idx) => {
      const monthNum = idx + 1;
      const monthPayroll = payrollData
        .filter(p => {
          const date = new Date(p.month);
          return date.getMonth() + 1 === monthNum && p.status === 'paid';
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
      const monthReimburse = reimbursements
        .filter(r => {
          const date = new Date(r.created_at);
          return date.getMonth() + 1 === monthNum && r.status === 'paid';
        })
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      
      const monthIncome = ledgerEntries
        .filter(l => {
          const date = new Date(l.date);
          return date.getMonth() + 1 === monthNum && l.type === 'income';
        })
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);

      return {
        month,
        payroll: monthPayroll,
        reimburse: monthReimburse,
        income: monthIncome,
        totalCost: monthPayroll + monthReimburse,
      };
    });
  }, [payrollData, reimbursements, ledgerEntries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Biaya Perusahaan</p>
                <p className="text-xl font-bold">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Payroll</p>
                <p className="text-xl font-bold">{formatCurrency(totalPayroll)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Receipt className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Reimbursement</p>
                <p className="text-xl font-bold">{formatCurrency(totalReimbursements)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cost per Employee</p>
                <p className="text-xl font-bold">{formatCurrency(costPerEmployee)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribusi Biaya</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {expenseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {expenseBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Tidak ada data
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trend Bulanan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="payroll" name="Payroll" fill="hsl(250, 80%, 60%)" stackId="cost" />
                  <Bar dataKey="reimburse" name="Reimburse" fill="hsl(25, 95%, 53%)" stackId="cost" />
                  <Bar dataKey="income" name="Income" fill="hsl(142, 76%, 36%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expense Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ringkasan Keuangan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-green-500/10">
              <p className="text-sm text-muted-foreground mb-1">Total Income</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-500/10">
              <p className="text-sm text-muted-foreground mb-1">Total Expense</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className={`text-center p-4 rounded-lg ${totalIncome - totalExpenses >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <p className="text-sm text-muted-foreground mb-1">Net Cashflow</p>
              <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalIncome - totalExpenses)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
