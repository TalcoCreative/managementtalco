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
import { format } from "date-fns";
import { Plus, ArrowDownCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { 
  FINANCE_CATEGORIES, 
  getMainCategoryLabel, 
  getSubCategoryLabel,
  getSubCategories 
} from "@/lib/finance-categories";

export function FinanceExpenses() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: "operasional",
    sub_category: "transport",
    project_id: "",
    client_id: "",
    amount: "",
    description: "",
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

      const { error } = await supabase.from("expenses").insert({
        category: formData.category,
        sub_category: formData.sub_category,
        project_id: formData.project_id || null,
        client_id: formData.client_id || null,
        amount: parseFloat(formData.amount),
        description: formData.description,
        created_by: session.session.user.id,
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
        description: "" 
      });
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to create expense");
    }
  };

  const handleMarkPaid = async (expense: any) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Create ledger entry
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("ledger_entries")
        .insert({
          date: format(new Date(), "yyyy-MM-dd"),
          type: "expense",
          sub_type: expense.category,
          sub_category: expense.sub_category,
          project_id: expense.project_id,
          client_id: expense.client_id,
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
    } catch (error: any) {
      toast.error(error.message || "Failed to mark expense as paid");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const subCategories = getSubCategories(formData.category);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ArrowDownCircle className="h-5 w-5" />
          Expenses
        </CardTitle>
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
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : expenses && expenses.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
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
                    <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
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
                      {expense.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => handleMarkPaid(expense)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
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
    </Card>
  );
}
