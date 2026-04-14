import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Plus, TrendingDown, AlertTriangle, CalendarIcon,
  DollarSign, ArrowUpRight, ArrowDownRight, Trash2, Edit,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORMS, ADS_PLATFORMS } from "@/lib/report-constants";

// ── Types ────────────────────────────────────────────────
type Budget = {
  id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  monthly_budget: number;
  carry_over: number;
  status: string;
  created_by: string;
  clients?: { id: string; name: string };
};

type Transaction = {
  id: string;
  budget_id: string;
  platform_account_id: string;
  transaction_date: string;
  transaction_date_end: string | null;
  transaction_type: string;
  amount: number;
  tax: number;
  notes: string | null;
  platform_accounts?: {
    id: string;
    account_name: string;
    platform: string;
    client_id: string;
    clients?: { id: string; name: string };
  };
};

type PlatformAccount = {
  id: string;
  client_id: string;
  platform: string;
  account_name: string;
  status: string;
  clients?: { id: string; name: string };
};

const TX_TYPES = [
  { value: "ads_spend", label: "Ads Spend", color: "destructive" },
  { value: "wallet_usage", label: "Wallet Usage", color: "destructive" },
  { value: "marketplace_spend", label: "Marketplace Spend", color: "destructive" },
  { value: "marketplace_topup", label: "Marketplace Top Up", color: "default" },
  { value: "top_up", label: "Top Up", color: "default" },
  { value: "transfer", label: "Transfer", color: "secondary" },
  { value: "other", label: "Lainnya", color: "secondary" },
] as const;

const USAGE_TYPES = ["ads_spend", "wallet_usage", "marketplace_spend"];

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

// ── Main Page ────────────────────────────────────────────
export default function AdsBudget() {
  const qc = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showTxDialog, setShowTxDialog] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [deleteBudgetId, setDeleteBudgetId] = useState<string | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);
  const [selectedBudgetForTx, setSelectedBudgetForTx] = useState<string | null>(null);

  // ── Budget form state
  const [bClientId, setBClientId] = useState("");
  const [bStartDate, setBStartDate] = useState<Date | undefined>();
  const [bEndDate, setBEndDate] = useState<Date | undefined>();
  const [bMonthlyBudget, setBMonthlyBudget] = useState("");
  const [bCarryOver, setBCarryOver] = useState("0");

  // ── Transaction form state
  const [txAccountId, setTxAccountId] = useState("");
  const [txDate, setTxDate] = useState<Date | undefined>(new Date());
  const [txType, setTxType] = useState("ads_spend");
  const [txAmount, setTxAmount] = useState("");
  const [txTax, setTxTax] = useState("0");
  const [txNotes, setTxNotes] = useState("");

  // ── Queries ────────────────────────────────────────────
  const { data: clients = [] } = useQuery({
    queryKey: ["ads-budget-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ["ads-budgets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads_budgets")
        .select("*, clients(id, name)")
        .order("start_date", { ascending: false });
      return (data || []) as Budget[];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["ads-budget-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads_budget_transactions")
        .select("*, platform_accounts(id, account_name, platform, client_id, clients(id, name))")
        .order("transaction_date", { ascending: false });
      return (data || []) as Transaction[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["ads-budget-accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_accounts")
        .select("id, client_id, platform, account_name, status, clients(id, name)")
        .eq("status", "active")
        .order("platform");
      return (data || []) as PlatformAccount[];
    },
  });

  // ── Mutations ──────────────────────────────────────────
  const saveBudget = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      const payload = {
        client_id: bClientId,
        start_date: bStartDate ? format(bStartDate, "yyyy-MM-dd") : "",
        end_date: bEndDate ? format(bEndDate, "yyyy-MM-dd") : "",
        monthly_budget: Number(bMonthlyBudget) || 0,
        carry_over: Number(bCarryOver) || 0,
        created_by: session.session.user.id,
      };
      if (editBudget) {
        const { error } = await supabase.from("ads_budgets").update(payload).eq("id", editBudget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ads_budgets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-budgets"] });
      toast.success(editBudget ? "Budget updated" : "Budget created");
      setShowBudgetDialog(false);
      resetBudgetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBudgetMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ads_budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-budgets"] });
      toast.success("Budget deleted");
      setDeleteBudgetId(null);
    },
  });

  const saveTx = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      const { error } = await supabase.from("ads_budget_transactions").insert({
        budget_id: selectedBudgetForTx!,
        platform_account_id: txAccountId,
        transaction_date: txDate ? format(txDate, "yyyy-MM-dd") : "",
        transaction_type: txType,
        amount: Number(txAmount) || 0,
        tax: Number(txTax) || 0,
        notes: txNotes || null,
        created_by: session.session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-budget-transactions"] });
      toast.success("Transaction added");
      setShowTxDialog(false);
      resetTxForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTxMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ads_budget_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-budget-transactions"] });
      toast.success("Transaction deleted");
      setDeleteTxId(null);
    },
  });

  // ── Helpers ────────────────────────────────────────────
  const resetBudgetForm = () => {
    setBClientId("");
    setBStartDate(undefined);
    setBEndDate(undefined);
    setBMonthlyBudget("");
    setBCarryOver("0");
    setEditBudget(null);
  };

  const resetTxForm = () => {
    setTxAccountId("");
    setTxDate(new Date());
    setTxType("ads_spend");
    setTxAmount("");
    setTxTax("0");
    setTxNotes("");
  };

  const openEditBudget = (b: Budget) => {
    setEditBudget(b);
    setBClientId(b.client_id);
    setBStartDate(parseISO(b.start_date));
    setBEndDate(parseISO(b.end_date));
    setBMonthlyBudget(String(b.monthly_budget));
    setBCarryOver(String(b.carry_over));
    setShowBudgetDialog(true);
  };

  const openNewBudget = () => {
    resetBudgetForm();
    setShowBudgetDialog(true);
  };

  const openNewTx = (budgetId: string) => {
    resetTxForm();
    setSelectedBudgetForTx(budgetId);
    setShowTxDialog(true);
  };

  // Auto-fill carry over from previous budget for same client
  const handleBudgetClientChange = (clientId: string) => {
    setBClientId(clientId);
    const prev = budgets
      .filter((b) => b.client_id === clientId)
      .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
    if (prev) {
      const prevTxs = transactions.filter((t) => t.budget_id === prev.id);
      const totalBudget = prev.monthly_budget + prev.carry_over;
      const totalUsage = prevTxs
        .filter((t) => USAGE_TYPES.includes(t.transaction_type))
        .reduce((s, t) => s + t.amount + t.tax, 0);
      const remaining = totalBudget - totalUsage;
      setBCarryOver(String(Math.max(0, remaining)));
    }
  };

  // ── Computed data ──────────────────────────────────────
  const filteredBudgets = useMemo(() => {
    if (selectedClientId === "all") return budgets;
    return budgets.filter((b) => b.client_id === selectedClientId);
  }, [budgets, selectedClientId]);

  const getBudgetCalcs = (budget: Budget) => {
    const budgetTxs = transactions.filter((t) => t.budget_id === budget.id);
    const totalBudget = budget.monthly_budget + budget.carry_over;
    const totalUsage = budgetTxs
      .filter((t) => USAGE_TYPES.includes(t.transaction_type))
      .reduce((s, t) => s + t.amount + t.tax, 0);
    const remaining = totalBudget - totalUsage;
    const deficit = remaining < 0 ? Math.abs(remaining) : 0;
    const carryOver = remaining > 0 ? remaining : 0;
    const pctUsed = totalBudget > 0 ? (totalUsage / totalBudget) * 100 : 0;
    const status = pctUsed >= 100 ? "deficit" : pctUsed >= 80 ? "warning" : "safe";
    return { totalBudget, totalUsage, remaining, deficit, carryOver, pctUsed, status, budgetTxs };
  };

  const summaryStats = useMemo(() => {
    let totalBudget = 0, totalUsage = 0, totalDeficit = 0, warningCount = 0;
    filteredBudgets.forEach((b) => {
      const c = getBudgetCalcs(b);
      totalBudget += c.totalBudget;
      totalUsage += c.totalUsage;
      totalDeficit += c.deficit;
      if (c.status === "warning" || c.status === "deficit") warningCount++;
    });
    return { totalBudget, totalUsage, remaining: totalBudget - totalUsage, totalDeficit, warningCount };
  }, [filteredBudgets, transactions]);

  // Master Wallet: total transfers vs total usage across all (filtered) budgets
  const walletStats = useMemo(() => {
    const budgetIds = new Set(filteredBudgets.map((b) => b.id));
    const relevantTxs = transactions.filter((t) => budgetIds.has(t.budget_id));
    const totalTransferred = relevantTxs
      .filter((t) => ["transfer", "top_up", "marketplace_topup"].includes(t.transaction_type))
      .reduce((s, t) => s + t.amount + t.tax, 0);
    const totalUsed = relevantTxs
      .filter((t) => USAGE_TYPES.includes(t.transaction_type))
      .reduce((s, t) => s + t.amount + t.tax, 0);
    return { totalTransferred, totalUsed, walletRemaining: totalTransferred - totalUsed };
  }, [filteredBudgets, transactions]);

  // Platform breakdown for a budget
  const getPlatformBreakdown = (budget: Budget) => {
    const txs = transactions.filter((t) => t.budget_id === budget.id && USAGE_TYPES.includes(t.transaction_type));
    const map: Record<string, { platform: string; subPlatform: string; usage: number; accounts: Set<string> }> = {};
    txs.forEach((t) => {
      const platform = t.platform_accounts?.platform || "unknown";
      const acctName = t.platform_accounts?.account_name || "unknown";
      const key = platform;
      if (!map[key]) map[key] = { platform, subPlatform: acctName, usage: 0, accounts: new Set() };
      map[key].usage += t.amount + t.tax;
      map[key].accounts.add(acctName);
    });
    return Object.values(map);
  };

  const accountsForBudget = (budgetId: string) => {
    const budget = budgets.find((b) => b.id === budgetId);
    if (!budget) return accounts;
    return accounts.filter((a) => a.client_id === budget.client_id);
  };

  const selectedAccount = accounts.find((a) => a.id === txAccountId);

  const statusBadge = (status: string) => {
    if (status === "deficit") return <Badge variant="destructive">Deficit</Badge>;
    if (status === "warning") return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Warning</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Safe</Badge>;
  };

  const platformLabel = (val: string) => {
    const p = [...PLATFORMS, ...ADS_PLATFORMS].find((p) => p.value === val);
    return p?.label || val;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ads Budget</h1>
            <p className="text-sm text-muted-foreground">Track ad spending budgets per client & platform</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openNewBudget}>
              <Plus className="h-4 w-4 mr-2" /> New Budget
            </Button>
          </div>
        </div>

        {/* Master Wallet Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Master Wallet</p>
                  <p className="text-xs text-muted-foreground">Total dana yang sudah ditransfer vs yang sudah digunakan</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 text-right w-full sm:w-auto">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Total Transferred</p>
                  <p className="text-lg font-bold text-primary">{fmtCurrency(walletStats.totalTransferred)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Total Used</p>
                  <p className="text-lg font-bold text-destructive">{fmtCurrency(walletStats.totalUsed)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Sisa Wallet</p>
                  <p className={cn("text-lg font-bold", walletStats.walletRemaining >= 0 ? "text-emerald-600" : "text-destructive")}>
                    {fmtCurrency(walletStats.walletRemaining)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Total Budget</p>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xl font-bold mt-1">{fmtCurrency(summaryStats.totalBudget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Total Usage</p>
                <ArrowUpRight className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-xl font-bold mt-1">{fmtCurrency(summaryStats.totalUsage)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Remaining</p>
                <ArrowDownRight className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold mt-1">{fmtCurrency(summaryStats.remaining)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Total Deficit</p>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-xl font-bold mt-1 text-destructive">{fmtCurrency(summaryStats.totalDeficit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Alerts</p>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-xl font-bold mt-1">{summaryStats.warningCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Budget List */}
        <div className="space-y-4">
          {budgetsLoading ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : filteredBudgets.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No budgets found. Create one to get started.</CardContent></Card>
          ) : (
            filteredBudgets.map((budget) => {
              const calc = getBudgetCalcs(budget);
              const isExpanded = expandedBudget === budget.id;
              const breakdown = getPlatformBreakdown(budget);

              return (
                <Card key={budget.id} className="overflow-hidden">
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedBudget(isExpanded ? null : budget.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <div>
                          <CardTitle className="text-base">{budget.clients?.name || "Unknown Client"}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(parseISO(budget.start_date), "dd MMM yyyy")} – {format(parseISO(budget.end_date), "dd MMM yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {statusBadge(calc.status)}
                        <div className="hidden sm:flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditBudget(budget); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openNewTx(budget.id); }}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Transaction
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteBudgetId(budget.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Summary Stats Row */}
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Monthly Budget</p>
                        <p className="font-semibold mt-0.5">{fmtCurrency(budget.monthly_budget)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Carry Over</p>
                        <p className="font-semibold mt-0.5">{fmtCurrency(budget.carry_over)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Total Budget</p>
                        <p className="font-semibold mt-0.5">{fmtCurrency(calc.totalBudget)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Total Usage</p>
                        <p className="font-semibold mt-0.5 text-destructive">{fmtCurrency(calc.totalUsage)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Remaining</p>
                        <p className={cn("font-semibold mt-0.5", calc.remaining < 0 ? "text-destructive" : "text-emerald-600")}>{fmtCurrency(calc.remaining)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Deficit</p>
                        <p className="font-semibold mt-0.5 text-destructive">{fmtCurrency(calc.deficit)}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", calc.pctUsed >= 100 ? "bg-destructive" : calc.pctUsed >= 80 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(calc.pctUsed, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{calc.pctUsed.toFixed(1)}% used</p>
                    </div>

                    {/* Mobile actions */}
                    <div className="flex sm:hidden items-center gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => openEditBudget(budget)}>
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openNewTx(budget.id)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Transaction
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteBudgetId(budget.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>

                  {/* Expanded: Platform Breakdown + Transactions */}
                  {isExpanded && (
                    <CardContent className="border-t pt-4 space-y-4">
                      {/* Platform Breakdown */}
                      {breakdown.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Platform Breakdown</h4>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Platform</TableHead>
                                  <TableHead>Accounts</TableHead>
                                  <TableHead className="text-right">Usage</TableHead>
                                  <TableHead className="text-right">% of Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {breakdown.map((row, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-medium">{platformLabel(row.platform)}</TableCell>
                                    <TableCell className="text-muted-foreground">{Array.from(row.accounts).join(", ")}</TableCell>
                                    <TableCell className="text-right">{fmtCurrency(row.usage)}</TableCell>
                                    <TableCell className="text-right">{calc.totalBudget > 0 ? ((row.usage / calc.totalBudget) * 100).toFixed(1) : 0}%</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Transactions */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Transactions ({calc.budgetTxs.length})</h4>
                        {calc.budgetTxs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No transactions yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Account</TableHead>
                                  <TableHead>Platform</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                  <TableHead className="text-right">Tax</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead>Notes</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {calc.budgetTxs.map((tx) => (
                                  <TableRow key={tx.id}>
                                    <TableCell className="whitespace-nowrap">{format(parseISO(tx.transaction_date), "dd MMM yyyy")}</TableCell>
                                    <TableCell>{tx.platform_accounts?.account_name || "-"}</TableCell>
                                    <TableCell>{platformLabel(tx.platform_accounts?.platform || "")}</TableCell>
                                    <TableCell>
                                      <Badge variant={USAGE_TYPES.includes(tx.transaction_type) ? "destructive" : "secondary"}>
                                        {TX_TYPES.find((t) => t.value === tx.transaction_type)?.label || tx.transaction_type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{fmtCurrency(tx.amount)}</TableCell>
                                    <TableCell className="text-right">{fmtCurrency(tx.tax)}</TableCell>
                                    <TableCell className="text-right font-medium">{fmtCurrency(tx.amount + tx.tax)}</TableCell>
                                    <TableCell className="max-w-[150px] truncate text-muted-foreground">{tx.notes || "-"}</TableCell>
                                    <TableCell>
                                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTxId(tx.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* ── Budget Dialog ─────────────────────────────────── */}
      <Dialog open={showBudgetDialog} onOpenChange={(o) => { if (!o) { setShowBudgetDialog(false); resetBudgetForm(); } else setShowBudgetDialog(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editBudget ? "Edit Budget" : "New Ads Budget"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client *</Label>
              <Select value={bClientId} onValueChange={handleBudgetClientChange}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !bStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bStartDate ? format(bStartDate, "dd MMM yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={bStartDate} onSelect={setBStartDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>End Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !bEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bEndDate ? format(bEndDate, "dd MMM yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={bEndDate} onSelect={setBEndDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monthly Budget (IDR) *</Label>
                <Input type="number" value={bMonthlyBudget} onChange={(e) => setBMonthlyBudget(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Carry Over (IDR)</Label>
                <Input type="number" value={bCarryOver} onChange={(e) => setBCarryOver(e.target.value)} placeholder="0" />
                <p className="text-[10px] text-muted-foreground mt-1">Auto-filled from previous period</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBudgetDialog(false); resetBudgetForm(); }}>Cancel</Button>
            <Button onClick={() => saveBudget.mutate()} disabled={!bClientId || !bStartDate || !bEndDate || !bMonthlyBudget || saveBudget.isPending}>
              {saveBudget.isPending ? "Saving..." : editBudget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transaction Dialog ────────────────────────────── */}
      <Dialog open={showTxDialog} onOpenChange={(o) => { if (!o) { setShowTxDialog(false); resetTxForm(); } else setShowTxDialog(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ad Account *</Label>
              <Select value={txAccountId} onValueChange={setTxAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accountsForBudget(selectedBudgetForTx || "").map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} ({platformLabel(a.platform)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAccount && (
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 rounded-lg p-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Client</p>
                  <p className="font-medium">{selectedAccount.clients?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Platform</p>
                  <p className="font-medium">{platformLabel(selectedAccount.platform)}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !txDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {txDate ? format(txDate, "dd MMM yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={txDate} onSelect={setTxDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={txType} onValueChange={setTxType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (IDR) *</Label>
                <Input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Tax (IDR)</Label>
                <Input type="number" value={txTax} onChange={(e) => setTxTax(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={txNotes} onChange={(e) => setTxNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTxDialog(false); resetTxForm(); }}>Cancel</Button>
            <Button onClick={() => saveTx.mutate()} disabled={!txAccountId || !txDate || !txAmount || saveTx.isPending}>
              {saveTx.isPending ? "Saving..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Budget Confirm */}
      <AlertDialog open={!!deleteBudgetId} onOpenChange={(o) => !o && setDeleteBudgetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget?</AlertDialogTitle>
            <AlertDialogDescription>This will also delete all transactions under this budget. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteBudgetId && deleteBudgetMut.mutate(deleteBudgetId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Transaction Confirm */}
      <AlertDialog open={!!deleteTxId} onOpenChange={(o) => !o && setDeleteTxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteTxId && deleteTxMut.mutate(deleteTxId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
