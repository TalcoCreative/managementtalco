import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Wallet, Send } from "lucide-react";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500", approved: "bg-blue-500", paid: "bg-green-500",
  requested: "bg-yellow-500", rejected: "bg-red-500",
};

export default function MyCommission() {
  const qc = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: userId } = useQuery({
    queryKey: ["session-uid"],
    queryFn: async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile-name", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: commissions } = useQuery({
    queryKey: ["my-commissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("commissions")
        .select("*, prospects(contact_name, company), products(name)")
        .eq("sales_id", userId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["my-withdrawals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("withdrawals").select("*").eq("sales_id", userId!).order("request_date", { ascending: false });
      return data || [];
    },
  });

  const sumByStatus = (s: string) =>
    (commissions || []).filter((c: any) => c.status === s).reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);

  const commApproved = sumByStatus("approved");
  const commPaid = sumByStatus("paid");
  const totalWithdrawn = (withdrawals || []).filter((w: any) => w.status === "paid").reduce((s: number, w: any) => s + Number(w.amount), 0);
  const pendingWithdraw = (withdrawals || []).filter((w: any) => w.status === "requested" || w.status === "approved").reduce((s: number, w: any) => s + Number(w.amount), 0);
  const available = commApproved + commPaid - totalWithdrawn - pendingWithdraw;

  const requestMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Amount must be > 0");
      if (amt > available) throw new Error("Amount exceeds available balance");
      const { error } = await (supabase as any).from("withdrawals").insert({
        sales_id: userId, amount: amt, notes: notes || null, status: "requested",
      });
      if (error) throw error;

      // Trigger WhatsApp link
      const message = `Withdrawal Request:\nNama: ${profile?.full_name || "-"}\nAmount: ${formatRp(amt)}\nDate: ${format(new Date(), "dd MMM yyyy HH:mm")}`;
      const url = `https://wa.me/6285117084889?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      toast.success("Withdrawal requested. WhatsApp opened to notify admin.");
      setWithdrawOpen(false);
      setAmount("");
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Commission</h1>
            <p className="text-sm text-muted-foreground mt-1">Earnings and withdrawal history</p>
          </div>
          <Button onClick={() => setWithdrawOpen(true)} disabled={available <= 0}>
            <Wallet className="h-4 w-4 mr-2" />Withdraw
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Available Balance</p><p className="text-2xl font-bold mt-1">{formatRp(available)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Approved</p><p className="text-2xl font-bold mt-1">{formatRp(commApproved)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Paid</p><p className="text-2xl font-bold mt-1">{formatRp(commPaid)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total Withdrawn</p><p className="text-2xl font-bold mt-1">{formatRp(totalWithdrawn)}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="commissions">
          <TabsList>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>

          <TabsContent value="commissions">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Prospect</TableHead><TableHead>Product</TableHead>
                  <TableHead>Deal Value</TableHead><TableHead>%</TableHead>
                  <TableHead>Commission</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(commissions || []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No commissions yet. Close a deal to earn!</TableCell></TableRow>
                  ) : (commissions || []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.prospects?.contact_name || "-"}<div className="text-xs text-muted-foreground">{c.prospects?.company}</div></TableCell>
                      <TableCell>{c.products?.name || "-"}</TableCell>
                      <TableCell>{formatRp(c.deal_value)}</TableCell>
                      <TableCell>{c.commission_percentage}%</TableCell>
                      <TableCell className="font-semibold">{formatRp(c.commission_amount)}</TableCell>
                      <TableCell><Badge className={`${STATUS_BADGE[c.status]} text-white capitalize`}>{c.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Amount</TableHead><TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead><TableHead>Processed</TableHead><TableHead>Notes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(withdrawals || []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No withdrawals yet.</TableCell></TableRow>
                  ) : (withdrawals || []).map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-semibold">{formatRp(w.amount)}</TableCell>
                      <TableCell><Badge className={`${STATUS_BADGE[w.status]} text-white capitalize`}>{w.status}</Badge></TableCell>
                      <TableCell className="text-xs">{format(new Date(w.request_date), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell className="text-xs">{w.processed_date ? format(new Date(w.processed_date), "dd MMM yyyy") : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{w.notes || w.admin_notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Withdraw Commission</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-md text-sm">
              Available balance: <span className="font-semibold">{formatRp(available)}</span>
            </div>
            <div>
              <Label>Amount (Rp)</Label>
              <Input type="number" min="1" max={available} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500000" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bank account details, etc." rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">After submitting, WhatsApp will open with a pre-filled message to admin.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>
              <Send className="h-4 w-4 mr-2" />Request Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
