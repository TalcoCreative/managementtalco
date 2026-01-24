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
import { Plus, ArrowUpCircle, Trash2, Search, Calendar } from "lucide-react";
import { toast } from "sonner";

export function FinanceIncome() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [formData, setFormData] = useState({
    source: "",
    client_id: "",
    project_id: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    type: "one_time",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: incomeList, isLoading } = useQuery({
    queryKey: ["finance-income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*, projects(title), clients(name)")
        .order("date", { ascending: false });
      
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

  // Filter income by search and date
  const filteredIncome = incomeList?.filter(income => {
    const matchesSearch = 
      income.source?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.projects?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const incomeDate = income.date;
    const matchesDateRange = incomeDate >= startDate && incomeDate <= endDate;

    return matchesSearch && matchesDateRange;
  });

  const handleSubmit = async () => {
    if (!formData.source || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const userId = session.session.user.id;
      const incomeDate = formData.date;
      const projectId = formData.project_id || null;
      const clientId = formData.client_id || null;

      // Create ledger entry first with the income date
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("ledger_entries")
        .insert({
          date: incomeDate,
          type: "income",
          sub_type: "project",
          project_id: projectId,
          client_id: clientId,
          amount: parseFloat(formData.amount),
          source: "income",
          notes: `${formData.source}${formData.notes ? ` - ${formData.notes}` : ""}`,
          created_by: userId,
        })
        .select()
        .single();

      if (ledgerError) throw ledgerError;

      // Create income with status received and link to ledger
      const { error } = await supabase.from("income").insert({
        source: formData.source,
        client_id: clientId,
        project_id: projectId,
        amount: parseFloat(formData.amount),
        date: incomeDate,
        type: formData.type,
        notes: formData.notes || null,
        created_by: userId,
        status: "received",
        received_at: new Date().toISOString(),
        ledger_entry_id: ledgerEntry.id,
      });

      if (error) throw error;

      toast.success("Income record created and added to ledger");
      setDialogOpen(false);
      setFormData({
        source: "",
        client_id: "",
        project_id: "",
        amount: "",
        date: format(new Date(), "yyyy-MM-dd"),
        type: "one_time",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["finance-income"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["income-statement-income"] });
      queryClient.invalidateQueries({ queryKey: ["balance-sheet-income"] });
      queryClient.invalidateQueries({ queryKey: ["insights-income"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to create income record");
    }
  };

  const handleDeleteIncome = async () => {
    if (!incomeToDelete) return;
    
    try {
      // Delete associated ledger entry if exists
      if (incomeToDelete.ledger_entry_id) {
        await supabase
          .from("ledger_entries")
          .delete()
          .eq("id", incomeToDelete.ledger_entry_id);
      }

      const { error } = await supabase
        .from("income")
        .delete()
        .eq("id", incomeToDelete.id);

      if (error) throw error;

      toast.success("Income deleted successfully");
      setDeleteDialogOpen(false);
      setIncomeToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["finance-income"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete income");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      // Get ledger entry IDs for selected income
      const selectedIncome = incomeList?.filter(i => selectedIds.includes(i.id)) || [];
      const ledgerEntryIds = selectedIncome
        .filter(i => i.ledger_entry_id)
        .map(i => i.ledger_entry_id);

      // Delete associated ledger entries
      if (ledgerEntryIds.length > 0) {
        await supabase
          .from("ledger_entries")
          .delete()
          .in("id", ledgerEntryIds);
      }

      const { error } = await supabase
        .from("income")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`${selectedIds.length} income berhasil dihapus`);
      setBulkDeleteDialogOpen(false);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["finance-income"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus income");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredIncome?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIncome?.map(i => i.id) || []);
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

  const totalIncome = filteredIncome?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ArrowUpCircle className="h-5 w-5" />
          Income
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Income
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Income Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Source *</Label>
                <Input
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="e.g., Project Payment, Retainer Fee"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (IDR) *</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Income Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client (Optional)</Label>
                <Select value={formData.client_id || "none"} onValueChange={(v) => setFormData({ ...formData, client_id: v === "none" ? "" : v })}>
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
              <div className="space-y-2">
                <Label>Project (Optional)</Label>
                <Select value={formData.project_id || "none"} onValueChange={(v) => setFormData({ ...formData, project_id: v === "none" ? "" : v })}>
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
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">Create Income Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary - Single Total */}
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Income</div>
            <div className="text-2xl font-bold text-green-500">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-2 block">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari source, notes..."
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
            <Button 
              variant="destructive" 
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus {selectedIds.length} item
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredIncome && filteredIncome.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedIds.length === filteredIncome.length && filteredIncome.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Client/Project</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncome.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(income.id)}
                        onCheckedChange={() => toggleSelect(income.id)}
                      />
                    </TableCell>
                    <TableCell>{format(new Date(income.date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="font-medium">
                      {income.source}
                      {income.recurring_id && (
                        <Badge variant="secondary" className="ml-2 text-xs">Recurring</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {income.clients?.name && <div>{income.clients.name}</div>}
                        {income.projects?.title && (
                          <div className="text-muted-foreground">{income.projects.title}</div>
                        )}
                        {!income.clients?.name && !income.projects?.title && "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-500">
                      +{formatCurrency(income.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {income.type === "one_time" ? "One-time" : "Recurring"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setIncomeToDelete(income);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowUpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No income records</p>
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Income</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus income "{incomeToDelete?.source}"? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteIncome}
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
            <AlertDialogTitle>Hapus {selectedIds.length} Income</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus {selectedIds.length} income yang dipilih? 
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
    </Card>
  );
}
