import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Settings, Check, CreditCard } from "lucide-react";
import { format, isPast } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientPaymentSectionProps {
  clientId: string;
  client: any;
  canEdit: boolean;
}

export function ClientPaymentSection({ clientId, client, canEdit }: ClientPaymentSectionProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const [paymentForm, setPaymentForm] = useState({
    payment_number: 1,
    due_date: "",
    amount: "",
    notes: "",
  });

  const [settingsForm, setSettingsForm] = useState({
    scheme: "monthly",
    payment_day: "",
    total_payments: "",
  });

  const { data: settings } = useQuery({
    queryKey: ["client-payment-settings", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payment_settings")
        .select("*")
        .eq("client_id", clientId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ["client-payments", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("*")
        .eq("client_id", clientId)
        .order("payment_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleAddPayment = async () => {
    if (!paymentForm.due_date || !paymentForm.amount) {
      toast.error("Tanggal dan nominal wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("client_payments").insert({
        client_id: clientId,
        payment_number: paymentForm.payment_number,
        due_date: paymentForm.due_date,
        amount: parseFloat(paymentForm.amount),
        notes: paymentForm.notes,
        created_by: session.session.user.id,
      });

      if (error) throw error;

      toast.success("Pembayaran ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["client-payments", clientId] });
      setAddDialogOpen(false);
      setPaymentForm({ payment_number: (payments?.length || 0) + 2, due_date: "", amount: "", notes: "" });
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan pembayaran");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_payment_settings")
        .upsert({
          client_id: clientId,
          scheme: settingsForm.scheme,
          payment_day: settingsForm.payment_day ? parseInt(settingsForm.payment_day) : null,
          total_payments: settingsForm.total_payments ? parseInt(settingsForm.total_payments) : null,
        });

      if (error) throw error;

      toast.success("Pengaturan pembayaran disimpan");
      queryClient.invalidateQueries({ queryKey: ["client-payment-settings", clientId] });
      setSettingsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (paymentId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from("client_payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (error) throw error;

      // Log activity
      if (session.session) {
        await supabase.rpc("log_client_activity", {
          p_client_id: clientId,
          p_action: "payment_paid",
          p_description: "Payment marked as paid",
          p_changed_by: session.session.user.id,
        });
      }

      toast.success("Pembayaran ditandai lunas");
      queryClient.invalidateQueries({ queryKey: ["client-payments", clientId] });
    } catch (error: any) {
      toast.error(error.message || "Gagal mengupdate pembayaran");
    }
  };

  const paidCount = payments?.filter(p => p.status === "paid").length || 0;
  const totalCount = payments?.length || 0;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
  const totalAmount = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const paidAmount = payments?.filter(p => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const getStatusBadge = (payment: any) => {
    if (payment.status === "paid") {
      return <Badge variant="default" className="bg-success">Paid</Badge>;
    }
    if (isPast(new Date(payment.due_date))) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    return <Badge variant="outline">Unpaid</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Total Pembayaran</p>
          <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Sudah Dibayar</p>
          <p className="text-xl font-bold text-success">{formatCurrency(paidAmount)}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Sisa</p>
          <p className="text-xl font-bold text-warning">{formatCurrency(totalAmount - paidAmount)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress Pembayaran</span>
          <span>{paidCount} dari {totalCount} pembayaran</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Settings & Add */}
      {canEdit && (
        <div className="flex justify-end gap-2">
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Pengaturan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pengaturan Pembayaran</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Skema Pembayaran</Label>
                  <Select
                    value={settingsForm.scheme}
                    onValueChange={(value) => setSettingsForm({ ...settingsForm, scheme: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Bulanan</SelectItem>
                      <SelectItem value="termin">Termin</SelectItem>
                      <SelectItem value="project_based">Project Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tanggal Pembayaran Rutin (1-31)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={settingsForm.payment_day}
                    onChange={(e) => setSettingsForm({ ...settingsForm, payment_day: e.target.value })}
                    placeholder="e.g. 25"
                  />
                </div>
                <div>
                  <Label>Total Pembayaran (Termin)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settingsForm.total_payments}
                    onChange={(e) => setSettingsForm({ ...settingsForm, total_payments: e.target.value })}
                    placeholder="e.g. 12"
                  />
                </div>
                <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
                  {saving ? "Menyimpan..." : "Simpan Pengaturan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Pembayaran
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Pembayaran</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Pembayaran ke-</Label>
                  <Input
                    type="number"
                    min="1"
                    value={paymentForm.payment_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_number: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Tanggal Jatuh Tempo</Label>
                  <Input
                    type="date"
                    value={paymentForm.due_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nominal</Label>
                  <Input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Catatan tambahan..."
                  />
                </div>
                <Button onClick={handleAddPayment} disabled={saving} className="w-full">
                  {saving ? "Menyimpan..." : "Tambah Pembayaran"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Payments Table */}
      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Loading...</div>
      ) : payments && payments.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead>Nominal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibayar</TableHead>
              {canEdit && <TableHead className="w-20">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{payment.payment_number}</TableCell>
                <TableCell>{format(new Date(payment.due_date), "dd MMM yyyy")}</TableCell>
                <TableCell>{formatCurrency(Number(payment.amount))}</TableCell>
                <TableCell>{getStatusBadge(payment)}</TableCell>
                <TableCell>
                  {payment.paid_at
                    ? format(new Date(payment.paid_at), "dd MMM yyyy")
                    : "-"}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    {payment.status !== "paid" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkPaid(payment.id)}
                      >
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Belum ada data pembayaran</p>
        </div>
      )}
    </div>
  );
}
