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
import { Plus, ArrowUpCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function FinanceIncome() {
  const [dialogOpen, setDialogOpen] = useState(false);
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
    } catch (error: any) {
      toast.error(error.message || "Failed to mark income as received");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const totalExpected = incomeList?.filter(i => i.status === "expected").reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  const totalReceived = incomeList?.filter(i => i.status === "received").reduce((sum, i) => sum + Number(i.amount), 0) || 0;

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
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project (Optional)</Label>
                <Select value={formData.project_id} onValueChange={(v) => setFormData({ ...formData, project_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : incomeList && incomeList.length > 0 ? (
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
                {incomeList.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell>{format(new Date(income.date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="font-medium">{income.source}</TableCell>
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
                      {income.status === "expected" && (
                        <Button size="sm" variant="outline" onClick={() => handleMarkReceived(income)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Received
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
            <ArrowUpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No income records</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
