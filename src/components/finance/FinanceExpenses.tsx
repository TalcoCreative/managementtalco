import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Plus, ArrowDownCircle, CheckCircle, Trash2, Search, Calendar } from "lucide-react";
import { toast } from "sonner";
import { 
  FINANCE_CATEGORIES, 
  getMainCategoryLabel, 
  getSubCategoryLabel,
  getSubCategories 
} from "@/lib/finance-categories";
import { ExcelActions } from "@/components/shared/ExcelActions";
import { EXPENSE_COLUMNS } from "@/lib/excel-utils";

export function FinanceExpenses() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkPaidDialogOpen, setBulkPaidDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [formData, setFormData] = useState({
    category: "operasional",
    sub_category: "transport",
    project_id: "",
    client_id: "",
    amount: "",
    description: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
  });
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["finance-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, projects(title), clients(name)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title").order("title");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Filter expenses by search and date
  const filteredExpenses = expenses?.filter(expense => {
    const matchesSearch = 
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.sub_category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.projects?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const expenseDate = format(new Date(expense.created_at), "yyyy-MM-dd");
    const matchesDateRange = expenseDate >= startDate && expenseDate <= endDate;

    return matchesSearch && matchesDateRange;
  });

  const handleCategoryChange = (category: string) => {
    const subCategories = getSubCategories(category);
    setFormData({ 
      ...formData, 
      category, 
      sub_category: subCategories[0]?.value || "" 
    });
  };

  const handleSubmit = async () => {
    if (!formData.amount || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Store original category for proper reporting
      // No mapping needed - store as-is for income statement & balance sheet

      const { error } = await supabase.from("expenses").insert({
        category: formData.category,
        sub_category: formData.sub_category,
        project_id: formData.project_id || null,
        client_id: formData.client_id || null,
        amount: parseFloat(formData.amount),
        description: formData.description,
        created_by: session.session.user.id,
        created_at: new Date(formData.expense_date).toISOString(),
      });

      if (error) throw error;

      toast.success("Expense created successfully");
      setDialogOpen(false);
      setFormData({ 
        category: "operasional", 
        sub_category: "transport",
        project_id: "", 
        client_id: "", 
        amount: "", 
        description: "",
        expense_date: format(new Date(), "yyyy-MM-dd"),
      });
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to create expense");
    }
  };

  // Map expense category to valid ledger sub_type
  const mapCategoryToSubType = (category: string): string => {
    const mapping: Record<string, string> = {
      'payroll': 'payroll',
      'reimburse': 'reimburse',
      'operasional': 'operational',
      'operational': 'operational',
      'project': 'project',
    };
    return mapping[category] || 'other';
  };

  const handleMarkPaid = async (expense: any) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Create ledger entry with valid sub_type
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("ledger_entries")
        .insert({
          date: format(new Date(), "yyyy-MM-dd"),
          type: "expense",
          sub_type: mapCategoryToSubType(expense.category),
          sub_category: expense.sub_category || null,
          project_id: expense.project_id || null,
          client_id: expense.client_id || null,
          amount: expense.amount,
          source: "manual",
          notes: expense.description,
          created_by: session.session.user.id,
        })
        .select()
        .single();

      if (ledgerError) throw ledgerError;

      // Update expense status
      const { error: updateError } = await supabase
        .from("expenses")
        .update({ 
          status: "paid", 
          paid_at: new Date().toISOString(),
          ledger_entry_id: ledgerEntry.id 
        })
        .eq("id", expense.id);

      if (updateError) throw updateError;

      toast.success("Expense marked as paid and added to ledger");
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      // Invalidate financial reports
      queryClient.invalidateQueries({ queryKey: ["income-statement-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balance-sheet-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["insights-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to mark expense as paid");
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseToDelete.id);

      if (error) throw error;

      toast.success("Expense deleted successfully");
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete expense");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`${selectedIds.length} expense berhasil dihapus`);
      setBulkDeleteDialogOpen(false);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus expense");
    }
  };

  const handleBulkMarkPaid = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Get selected pending expenses
      const pendingExpenses = filteredExpenses?.filter(
        e => selectedIds.includes(e.id) && e.status === "pending"
      ) || [];

      if (pendingExpenses.length === 0) {
        toast.error("Tidak ada expense pending yang dipilih");
        return;
      }

      // Process each expense
      for (const expense of pendingExpenses) {
        // Create ledger entry with valid sub_type
        const { data: ledgerEntry, error: ledgerError } = await supabase
          .from("ledger_entries")
          .insert({
            date: format(new Date(), "yyyy-MM-dd"),
            type: "expense",
            sub_type: mapCategoryToSubType(expense.category),
            sub_category: expense.sub_category || null,
            project_id: expense.project_id || null,
            client_id: expense.client_id || null,
            amount: expense.amount,
            source: "manual",
            notes: expense.description,
            created_by: session.session.user.id,
          })
          .select()
          .single();

        if (ledgerError) throw ledgerError;

        // Update expense status
        const { error: updateError } = await supabase
          .from("expenses")
          .update({ 
            status: "paid", 
            paid_at: new Date().toISOString(),
            ledger_entry_id: ledgerEntry.id 
          })
          .eq("id", expense.id);

        if (updateError) throw updateError;
      }

      toast.success(`${pendingExpenses.length} expense berhasil ditandai sebagai paid`);
      setBulkPaidDialogOpen(false);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["income-statement-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balance-sheet-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["insights-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal mark as paid");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses?.map(e => e.id) || []);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const subCategories = getSubCategories(formData.category);

  // Export data for Excel
  const exportData = filteredExpenses?.map(e => ({
    date: format(new Date(e.created_at), "yyyy-MM-dd"),
    category: e.category,
    sub_category: e.sub_category || '',
    description: e.description,
    amount: e.amount,
    project_name: e.projects?.title || '',
    client_name: e.clients?.name || '',
    status: e.status,
  })) || [];

  const handleImportExpenses = async (data: any[]) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      toast.error("Tidak terautentikasi");
      return;
    }

    for (const row of data) {
      if (!row.description || !row.amount) continue;

      await supabase.from("expenses").insert({
        category: row.category || 'operational',
        sub_category: row.sub_category || null,
        amount: Number(row.amount),
        description: row.description,
        status: row.status || 'pending',
        created_by: session.session.user.id,
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
  };

  const totalPending = filteredExpenses?.filter(e => e.status === "pending").reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const totalPaid = filteredExpenses?.filter(e => e.status === "paid").reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2">
          <ArrowDownCircle className="h-5 w-5" />
          Expenses
        </CardTitle>
        <div className="flex gap-2">
          <ExcelActions
            data={exportData}
            columns={EXPENSE_COLUMNS}
            filename="expenses"
            onImport={handleImportExpenses}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Main Category *</Label>
                  <Select value={formData.category} onValueChange={handleCategoryChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FINANCE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sub-Category *</Label>
                  <Select 
                    value={formData.sub_category} 
                    onValueChange={(v) => setFormData({ ...formData, sub_category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories.map((sub) => (
                        <SelectItem key={sub.value} value={sub.value}>
                          {sub.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Expense *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount (IDR) *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Enter amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the expense"
                />
              </div>
              <div className="space-y-2">
                <Label>Project (Optional)</Label>
                <Select 
                  value={formData.project_id || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, project_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client (Optional)</Label>
                <Select 
                  value={formData.client_id || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, client_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmit} className="w-full">Create Expense</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="text-2xl font-bold text-yellow-500">{formatCurrency(totalPending)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Paid</div>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(totalPaid)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-2 block">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari deskripsi, kategori..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="min-w-[150px]">
            <Label className="text-sm mb-2 block">Dari Tanggal</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="min-w-[150px]">
            <Label className="text-sm mb-2 block">Sampai Tanggal</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setBulkPaidDialogOpen(true)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Paid ({selectedIds.filter(id => filteredExpenses?.find(e => e.id === id && e.status === "pending")).length})
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Hapus {selectedIds.length} item
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredExpenses && filteredExpenses.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Project/Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(expense.id)}
                        onCheckedChange={() => toggleSelect(expense.id)}
                      />
                    </TableCell>
                    <TableCell>{format(new Date(expense.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">{getMainCategoryLabel(expense.category)}</Badge>
                        {expense.sub_category && (
                          <div className="text-xs text-muted-foreground">
                            {getSubCategoryLabel(expense.category, expense.sub_category)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {expense.description}
                      {expense.is_recurring && (
                        <Badge variant="secondary" className="ml-2 text-xs">Recurring</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {expense.projects?.title && <div>{expense.projects.title}</div>}
                        {expense.clients?.name && (
                          <div className="text-muted-foreground">{expense.clients.name}</div>
                        )}
                        {!expense.projects?.title && !expense.clients?.name && "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={expense.status === "paid" ? "bg-green-500" : "bg-yellow-500"}>
                        {expense.status === "paid" ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {expense.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(expense)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setExpenseToDelete(expense);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowDownCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No expenses recorded</p>
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus expense "{expenseToDelete?.description}"? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExpense}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.length} Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus {selectedIds.length} expense yang dipilih? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus {selectedIds.length} Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkPaidDialogOpen} onOpenChange={setBulkPaidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Paid</AlertDialogTitle>
            <AlertDialogDescription>
              Tandai {selectedIds.filter(id => filteredExpenses?.find(e => e.id === id && e.status === "pending")).length} expense pending sebagai paid? 
              Ini akan membuat entry di ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkMarkPaid}>
              Mark as Paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
