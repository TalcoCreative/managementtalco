import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FINANCE_CATEGORIES, getSubCategories } from "@/lib/finance-categories";

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: any;
  projects: { id: string; title: string }[];
  clients: { id: string; name: string }[];
}

export function EditExpenseDialog({ 
  open, 
  onOpenChange, 
  expense, 
  projects, 
  clients 
}: EditExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    category: "",
    sub_category: "",
    project_id: "",
    client_id: "",
    amount: "",
    description: "",
    expense_date: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (expense && open) {
      setFormData({
        category: expense.category || "operasional",
        sub_category: expense.sub_category || "",
        project_id: expense.project_id || "",
        client_id: expense.client_id || "",
        amount: expense.amount?.toString() || "",
        description: expense.description || "",
        expense_date: expense.created_at 
          ? format(new Date(expense.created_at), "yyyy-MM-dd") 
          : format(new Date(), "yyyy-MM-dd"),
      });
    }
  }, [expense, open]);

  const handleCategoryChange = (category: string) => {
    const subCategories = getSubCategories(category);
    setFormData({ 
      ...formData, 
      category, 
      sub_category: subCategories[0]?.value || "" 
    });
  };

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

  const handleSubmit = async () => {
    if (!formData.amount || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const expenseDate = formData.expense_date;
      const subType = mapCategoryToSubType(formData.category);

      // Update ledger entry if exists
      if (expense.ledger_entry_id) {
        await supabase
          .from("ledger_entries")
          .update({
            date: expenseDate,
            sub_type: subType,
            sub_category: formData.sub_category || null,
            project_id: formData.project_id || null,
            client_id: formData.client_id || null,
            amount: parseFloat(formData.amount),
            notes: formData.description,
          })
          .eq("id", expense.ledger_entry_id);
      }

      // Update expense
      const { error } = await supabase
        .from("expenses")
        .update({
          category: formData.category,
          sub_category: formData.sub_category,
          project_id: formData.project_id || null,
          client_id: formData.client_id || null,
          amount: parseFloat(formData.amount),
          description: formData.description,
          created_at: new Date(expenseDate).toISOString(),
          paid_at: new Date(expenseDate).toISOString(),
        })
        .eq("id", expense.id);

      if (error) throw error;

      toast.success("Expense updated successfully");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger-all"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const subCategories = getSubCategories(formData.category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
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

          <Button onClick={handleSubmit} className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
