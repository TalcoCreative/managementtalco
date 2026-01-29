import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

interface EditIncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income: any;
  projects: { id: string; title: string }[];
  clients: { id: string; name: string }[];
}

export function EditIncomeDialog({ 
  open, 
  onOpenChange, 
  income, 
  projects, 
  clients 
}: EditIncomeDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    source: "",
    client_id: "",
    project_id: "",
    amount: "",
    date: "",
    type: "one_time",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (income && open) {
      setFormData({
        source: income.source || "",
        client_id: income.client_id || "",
        project_id: income.project_id || "",
        amount: income.amount?.toString() || "",
        date: income.date || format(new Date(), "yyyy-MM-dd"),
        type: income.type || "one_time",
        notes: income.notes || "",
      });
    }
  }, [income, open]);

  const handleSubmit = async () => {
    if (!formData.source || !formData.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const incomeDate = formData.date;
      const projectId = formData.project_id || null;
      const clientId = formData.client_id || null;

      // Update ledger entry if exists
      if (income.ledger_entry_id) {
        await supabase
          .from("ledger_entries")
          .update({
            date: incomeDate,
            project_id: projectId,
            client_id: clientId,
            amount: parseFloat(formData.amount),
            notes: `${formData.source}${formData.notes ? ` - ${formData.notes}` : ""}`,
          })
          .eq("id", income.ledger_entry_id);
      }

      // Update income
      const { error } = await supabase
        .from("income")
        .update({
          source: formData.source,
          client_id: clientId,
          project_id: projectId,
          amount: parseFloat(formData.amount),
          date: incomeDate,
          type: formData.type,
          notes: formData.notes || null,
        })
        .eq("id", income.id);

      if (error) throw error;

      toast.success("Income updated successfully");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["finance-income"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger-all"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update income");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Income</DialogTitle>
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
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Income"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
