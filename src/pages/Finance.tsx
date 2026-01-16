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
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Finance Center</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-max sm:w-full sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-1 h-auto p-1">
            {canViewDashboard && (
              <TabsTrigger value="dashboard" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Dashboard</span>
              </TabsTrigger>
            )}
            {canViewLedger && (
              <TabsTrigger value="ledger" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Ledger</span>
              </TabsTrigger>
            )}
            {canViewExpenses && (
              <TabsTrigger value="expenses" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                <ArrowDownCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Expenses</span>
              </TabsTrigger>
            )}
            {canViewRecurring && (
              <TabsTrigger value="recurring" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Recurring</span>
              </TabsTrigger>
            )}
            {canViewPayroll && (
              <TabsTrigger value="payroll" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Payroll</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="reimbursements" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Reimburse</span>
            </TabsTrigger>
            {canViewIncome && (
              <TabsTrigger value="income" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                <ArrowUpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Income</span>
              </TabsTrigger>
            )}
            {canViewInsights && (
              <TabsTrigger value="insights" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Insights</span>
              </TabsTrigger>
            )}
          </TabsList>
          </div>

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
