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
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Plus, ArrowUpCircle, CheckCircle, Trash2, Search, Calendar } from "lucide-react";
import { toast } from "sonner";

export function FinanceIncome() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState<any>(null);
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

      const { error } = await supabase.from("income").insert({
        source: formData.source,
        client_id: formData.client_id || null,
        project_id: formData.project_id || null,
        amount: parseFloat(formData.amount),
        date: formData.date,
        type: formData.type,
        notes: formData.notes || null,
        created_by: session.session.user.id,
      });

      if (error) throw error;

      toast.success("Income record created");
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
    } catch (error: any) {
      toast.error(error.message || "Failed to create income record");
    }
  };

  const handleMarkReceived = async (income: any) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Create ledger entry
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("ledger_entries")
        .insert({
          date: format(new Date(), "yyyy-MM-dd"),
          type: "income",
          sub_type: "project",
          project_id: income.project_id,
          client_id: income.client_id,
          amount: income.amount,
          source: "income",
          notes: `${income.source}${income.notes ? ` - ${income.notes}` : ""}`,
          created_by: session.session.user.id,
        })
        .select()
        .single();

      if (ledgerError) throw ledgerError;

      // Update income status
      const { error: updateError } = await supabase
        .from("income")
        .update({ 
          status: "received", 
          received_at: new Date().toISOString(),
          ledger_entry_id: ledgerEntry.id 
        })
        .eq("id", income.id);

      if (updateError) throw updateError;

      toast.success("Income marked as received and added to ledger");
      queryClient.invalidateQueries({ queryKey: ["finance-income"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      // Invalidate financial reports
      queryClient.invalidateQueries({ queryKey: ["income-statement-income"] });
      queryClient.invalidateQueries({ queryKey: ["balance-sheet-income"] });
      queryClient.invalidateQueries({ queryKey: ["insights-income"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to mark income as received");
    }
  };

  const handleDeleteIncome = async () => {
    if (!incomeToDelete) return;
    
    try {
      const { error } = await supabase
        .from("income")
        .delete()
        .eq("id", incomeToDelete.id);

      if (error) throw error;

      toast.success("Income deleted successfully");
      setDeleteDialogOpen(false);
      setIncomeToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["finance-income"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete income");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const totalExpected = filteredIncome?.filter(i => i.status === "expected").reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  const totalReceived = filteredIncome?.filter(i => i.status === "received").reduce((sum, i) => sum + Number(i.amount), 0) || 0;

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
                  <Label>Date *</Label>
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
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Expected</div>
              <div className="text-2xl font-bold text-yellow-500">{formatCurrency(totalExpected)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Received</div>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(totalReceived)}</div>
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
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredIncome && filteredIncome.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Client/Project</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncome.map((income) => (
                  <TableRow key={income.id}>
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
                      <Badge className={income.status === "received" ? "bg-green-500" : "bg-yellow-500"}>
                        {income.status === "received" ? "Received" : "Expected"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {income.status === "expected" && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkReceived(income)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Received
                          </Button>
                        )}
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
                      </div>
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
    </Card>
  );
}
