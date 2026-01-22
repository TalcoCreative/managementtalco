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
import { format } from "date-fns";
import { Plus, Receipt, CheckCircle, XCircle, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { REIMBURSE_CATEGORY_MAPPING } from "@/lib/finance-categories";

interface Props {
  canApprove: boolean;
  canMarkPaid: boolean;
}

export function FinanceReimbursements({ canApprove, canMarkPaid }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reimburseToDelete, setReimburseToDelete] = useState<any>(null);
  const [formData, setFormData] = useState({
    amount: "",
    project_id: "",
    client_id: "",
    request_from: "operational",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      return session.session?.user || null;
    },
  });

  const { data: reimbursements, isLoading } = useQuery({
    queryKey: ["finance-reimbursements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reimbursements")
        .select("*, projects(title), clients(name)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Fetch user names separately
      const userIds = [...new Set(data?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      
      return data?.map(r => ({
        ...r,
        requester_name: profiles?.find(p => p.id === r.user_id)?.full_name || "Unknown"
      })) || [];
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
    if (!formData.amount) {
      toast.error("Please enter amount");
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("reimbursements").insert({
        user_id: session.session.user.id,
        amount: parseFloat(formData.amount),
        project_id: formData.project_id || null,
        client_id: formData.client_id || null,
        request_from: formData.request_from,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast.success("Reimbursement request submitted");
      setDialogOpen(false);
      setFormData({ amount: "", project_id: "", client_id: "", request_from: "operational", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["finance-reimbursements"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to submit reimbursement");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("reimbursements")
        .update({ 
          status: "approved",
          approved_by: session.session.user.id,
          approved_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Reimbursement approved");
      queryClient.invalidateQueries({ queryKey: ["finance-reimbursements"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to approve reimbursement");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from("reimbursements")
        .update({ status: "rejected" })
        .eq("id", id);

      if (error) throw error;

      toast.success("Reimbursement rejected");
      queryClient.invalidateQueries({ queryKey: ["finance-reimbursements"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to reject reimbursement");
    }
  };

  const handleMarkPaid = async (reimburse: any) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Ensure null values for optional fields (not undefined or string "undefined")
      const projectId = reimburse.project_id && reimburse.project_id !== "undefined" ? reimburse.project_id : null;
      const clientId = reimburse.client_id && reimburse.client_id !== "undefined" ? reimburse.client_id : null;

      // Create ledger entry with valid sub_type for constraint
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("ledger_entries")
        .insert({
          date: format(new Date(), "yyyy-MM-dd"),
          type: "expense",
          sub_type: "reimburse",
          sub_category: reimburse.request_from || null,
          project_id: projectId,
          client_id: clientId,
          amount: reimburse.amount,
          source: "reimburse",
          notes: reimburse.notes || `Reimbursement - ${reimburse.request_from}`,
          created_by: session.session.user.id,
        })
        .select()
        .single();

      if (ledgerError) throw ledgerError;

      // Create expense entry
      const { error: expenseError } = await supabase
        .from("expenses")
        .insert({
          category: "reimburse",
          sub_category: reimburse.request_from || null,
          project_id: projectId,
          client_id: clientId,
          amount: reimburse.amount,
          description: reimburse.notes || `Reimbursement - ${reimburse.request_from}`,
          status: "paid",
          paid_at: new Date().toISOString(),
          ledger_entry_id: ledgerEntry.id,
          created_by: session.session.user.id,
        });

      if (expenseError) throw expenseError;

      // Update reimbursement status
      const { error: updateError } = await supabase
        .from("reimbursements")
        .update({ 
          status: "paid", 
          paid_at: new Date().toISOString(),
          ledger_entry_id: ledgerEntry.id 
        })
        .eq("id", reimburse.id);

      if (updateError) throw updateError;

      toast.success("Reimbursement paid dan masuk ke Expenses");
      queryClient.invalidateQueries({ queryKey: ["finance-reimbursements"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to mark reimbursement as paid");
    }
  };

  const handleDeleteReimbursement = async () => {
    if (!reimburseToDelete) return;
    
    try {
      const { error } = await supabase
        .from("reimbursements")
        .delete()
        .eq("id", reimburseToDelete.id);

      if (error) throw error;

      toast.success("Reimbursement deleted successfully");
      setDeleteDialogOpen(false);
      setReimburseToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["finance-reimbursements"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete reimbursement");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getRequestFromLabel = (type: string) => {
    const labels: Record<string, string> = {
      event: "Event",
      meeting: "Meeting",
      production: "Production",
      operational: "Operational",
      other: "Other"
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500";
      case "approved": return "bg-blue-500";
      case "rejected": return "bg-destructive";
      case "paid": return "bg-green-500";
      default: return "bg-muted";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Reimbursements
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Submit Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Reimbursement Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
                <Label>Request From *</Label>
                <Select value={formData.request_from} onValueChange={(v) => setFormData({ ...formData, request_from: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes..."
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">Submit Request</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : reimbursements && reimbursements.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Judul/Kategori</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Project/Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reimbursements.map((reimburse) => (
                  <TableRow key={reimburse.id}>
                    <TableCell>{format(new Date(reimburse.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={(reimburse as any).request_type === "request" ? "default" : "secondary"}>
                        {(reimburse as any).request_type === "request" ? "Request" : "Reimburse"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{reimburse.requester_name}</TableCell>
                    <TableCell>
                      <div>
                        {(reimburse as any).title && (
                          <div className="font-medium">{(reimburse as any).title}</div>
                        )}
                        <Badge variant="outline" className="mt-1">{getRequestFromLabel(reimburse.request_from)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(reimburse.amount)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {reimburse.projects?.title && <div>{reimburse.projects.title}</div>}
                        {reimburse.clients?.name && (
                          <div className="text-muted-foreground">{reimburse.clients.name}</div>
                        )}
                        {!reimburse.projects?.title && !reimburse.clients?.name && "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(reimburse.status)}>
                        {reimburse.status.charAt(0).toUpperCase() + reimburse.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {reimburse.status === "pending" && canApprove && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleApprove(reimburse.id)}>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleReject(reimburse.id)}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {reimburse.status === "approved" && canMarkPaid && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(reimburse)}>
                            <Wallet className="h-4 w-4 mr-1" />
                            Pay
                          </Button>
                        )}
                        {canApprove && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setReimburseToDelete(reimburse);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reimbursement/request</p>
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Reimbursement</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus reimbursement dari "{reimburseToDelete?.requester_name}"? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReimbursement}
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
