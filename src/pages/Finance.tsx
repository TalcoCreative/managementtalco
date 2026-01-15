import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { FinanceLedger } from "@/components/finance/FinanceLedger";
import { FinanceExpenses } from "@/components/finance/FinanceExpenses";
import { FinanceRecurring } from "@/components/finance/FinanceRecurring";
import { FinancePayroll } from "@/components/finance/FinancePayroll";
import { FinanceReimbursements } from "@/components/finance/FinanceReimbursements";
import { FinanceIncome } from "@/components/finance/FinanceIncome";
import { FinanceInsights } from "@/components/finance/FinanceInsights";
import { 
  LayoutDashboard, 
  BookOpen, 
  ArrowDownCircle, 
  RefreshCw, 
  Users, 
  Receipt, 
  ArrowUpCircle,
  Lightbulb,
} from "lucide-react";

export default function Finance() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-finance"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id);
      
      return data?.map(r => r.role) || [];
    },
  });

  const isSuperAdmin = userRoles?.includes("super_admin");
  const isFinance = userRoles?.includes("finance");
  const isAccounting = userRoles?.includes("accounting");
  const isHR = userRoles?.includes("hr");

  const canViewDashboard = isSuperAdmin || isFinance || isAccounting || isHR;
  const canViewLedger = isSuperAdmin || isFinance || isAccounting || isHR;
  const canViewExpenses = isSuperAdmin || isFinance || isAccounting || isHR;
  const canViewRecurring = isSuperAdmin || isFinance || isAccounting;
  const canViewPayroll = isSuperAdmin || isFinance || isHR;
  const canViewIncome = isSuperAdmin || isFinance || isAccounting;
  const canViewInsights = isSuperAdmin || isFinance || isAccounting;
  // All users can view reimbursements (their own)
  const canViewReimbursements = true;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Finance Center</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-8 lg:w-auto lg:inline-grid gap-1">
            {canViewDashboard && (
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
            )}
            {canViewLedger && (
              <TabsTrigger value="ledger" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Ledger</span>
              </TabsTrigger>
            )}
            {canViewExpenses && (
              <TabsTrigger value="expenses" className="flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Expenses</span>
              </TabsTrigger>
            )}
            {canViewRecurring && (
              <TabsTrigger value="recurring" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Recurring</span>
              </TabsTrigger>
            )}
            {canViewPayroll && (
              <TabsTrigger value="payroll" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Payroll</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="reimbursements" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Reimburse</span>
            </TabsTrigger>
            {canViewIncome && (
              <TabsTrigger value="income" className="flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Income</span>
              </TabsTrigger>
            )}
            {canViewInsights && (
              <TabsTrigger value="insights" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                <span className="hidden sm:inline">Insights</span>
              </TabsTrigger>
            )}
          </TabsList>

          {canViewDashboard && (
            <TabsContent value="dashboard">
              <FinanceDashboard />
            </TabsContent>
          )}

          {canViewLedger && (
            <TabsContent value="ledger">
              <FinanceLedger />
            </TabsContent>
          )}

          {canViewExpenses && (
            <TabsContent value="expenses">
              <FinanceExpenses />
            </TabsContent>
          )}

          {canViewRecurring && (
            <TabsContent value="recurring">
              <FinanceRecurring />
            </TabsContent>
          )}

          {canViewPayroll && (
            <TabsContent value="payroll">
              <FinancePayroll />
            </TabsContent>
          )}

          <TabsContent value="reimbursements">
            <FinanceReimbursements 
              canApprove={isSuperAdmin || isFinance || isHR} 
              canMarkPaid={isSuperAdmin || isFinance}
            />
          </TabsContent>

          {canViewIncome && (
            <TabsContent value="income">
              <FinanceIncome />
            </TabsContent>
          )}

          {canViewInsights && (
            <TabsContent value="insights">
              <FinanceInsights />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
