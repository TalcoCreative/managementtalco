import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Receipt, Plus, Clock, CheckCircle, XCircle, Wallet, TrendingUp, FileText } from "lucide-react";
import { toast } from "sonner";

const REIMBURSEMENT_CATEGORIES = [
  { value: "event", label: "Event" },
  { value: "meeting", label: "Meeting" },
  { value: "production", label: "Production" },
  { value: "operational", label: "Operational" },
  { value: "other", label: "Lainnya" },
];

const REQUEST_CATEGORIES = [
  { value: "training", label: "Pelatihan / Training" },
  { value: "equipment", label: "Equipment / Peralatan" },
  { value: "software", label: "Software / Tools" },
  { value: "transport", label: "Transport / Perjalanan" },
  { value: "event", label: "Event / Seminar" },
  { value: "other", label: "Lainnya" },
];

export default function MyReimbursement() {
  const [activeTab, setActiveTab] = useState("reimbursement");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"reimbursement" | "request">("reimbursement");
  const [formData, setFormData] = useState({
    title: "",
    request_from: "operational",
    amount: "",
    notes: "",
    project_id: "",
    client_id: "",
  });
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.session.user.id)
        .maybeSingle();
      
      return { ...session.session.user, profile };
    },
  });

  const { data: myReimbursements, isLoading } = useQuery({
    queryKey: ["my-reimbursements", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data, error } = await supabase
        .from("reimbursements")
        .select("*, projects(title), clients(name)")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.id,
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

  // Filter by type
  const reimbursements = myReimbursements?.filter(r => (r as any).request_type !== "request") || [];
  const requests = myReimbursements?.filter(r => (r as any).request_type === "request") || [];

  // Calculate monthly stats
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());
  
  const calculateStats = (items: any[]) => {
    return items.reduce((acc, r) => {
      const createdAt = new Date(r.created_at);
      if (createdAt >= currentMonthStart && createdAt <= currentMonthEnd) {
        acc.total += Number(r.amount);
        acc.count += 1;
        if (r.status === "paid") {
          acc.paid += Number(r.amount);
          acc.paidCount += 1;
        } else if (r.status === "approved") {
          acc.approved += Number(r.amount);
        } else if (r.status === "pending") {
          acc.pending += Number(r.amount);
        }
      }
      return acc;
    }, { total: 0, count: 0, paid: 0, paidCount: 0, approved: 0, pending: 0 });
  };

  const reimbursementStats = calculateStats(reimbursements);
  const requestStats = calculateStats(requests);

  const openDialog = (type: "reimbursement" | "request") => {
    setDialogType(type);
    setFormData({
      title: "",
      request_from: type === "reimbursement" ? "operational" : "training",
      amount: "",
      notes: "",
      project_id: "",
      client_id: "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.amount || !formData.request_from) {
      toast.error("Mohon isi jumlah dan kategori");
      return;
    }

    if (dialogType === "request" && !formData.title) {
      toast.error("Mohon isi judul request");
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("reimbursements").insert({
        user_id: session.session.user.id,
        request_type: dialogType,
        title: formData.title || null,
        request_from: formData.request_from,
        amount: parseFloat(formData.amount),
        notes: formData.notes || null,
        project_id: formData.project_id || null,
        client_id: formData.client_id || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success(dialogType === "reimbursement" 
        ? "Reimbursement berhasil diajukan" 
        : "Request berhasil diajukan"
      );
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-reimbursements"] });
      queryClient.invalidateQueries({ queryKey: ["finance-reimbursements"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal mengajukan");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-blue-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge className="bg-destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "paid":
        return <Badge className="bg-green-500"><Wallet className="h-3 w-3 mr-1" />Paid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCategoryLabel = (value: string, type: string) => {
    const categories = type === "request" ? REQUEST_CATEGORIES : REIMBURSEMENT_CATEGORIES;
    return categories.find(o => o.value === value)?.label || value;
  };

  const renderStatsCards = (stats: any, type: string) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Total Bulan Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(stats.total)}</p>
          <p className="text-xs text-muted-foreground">{stats.count} {type}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.pending)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.approved)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {type === "request" ? "Disetujui & Dibayar" : "Sudah Dibayar"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.paid)}</p>
          <p className="text-xs text-muted-foreground">{stats.paidCount} selesai</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderTable = (items: any[], type: string) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {type === "request" ? <FileText className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
          {type === "request" ? "Daftar Request Saya" : "Daftar Reimbursement Saya"}
        </CardTitle>
        <Button onClick={() => openDialog(type as "reimbursement" | "request")}>
          <Plus className="h-4 w-4 mr-2" />
          {type === "request" ? "Ajukan Request" : "Ajukan Reimbursement"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  {type === "request" && <TableHead>Judul</TableHead>}
                  <TableHead>Kategori</TableHead>
                  <TableHead>Project/Client</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(r.created_at), "dd MMM yyyy", { locale: idLocale })}
                    </TableCell>
                    {type === "request" && (
                      <TableCell className="font-medium">
                        {(r as any).title || "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(r.request_from, type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {r.projects?.title && <div>{r.projects.title}</div>}
                        {r.clients?.name && (
                          <div className="text-muted-foreground">{r.clients.name}</div>
                        )}
                        {!r.projects?.title && !r.clients?.name && "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(r.amount)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {r.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getStatusBadge(r.status)}
                        {r.status === "rejected" && r.rejection_reason && (
                          <p className="text-xs text-destructive">{r.rejection_reason}</p>
                        )}
                        {r.status === "paid" && r.paid_at && (
                          <p className="text-xs text-muted-foreground">
                            Dibayar: {format(new Date(r.paid_at), "dd MMM yyyy")}
                          </p>
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
            {type === "request" ? <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /> : <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />}
            <p>Belum ada {type === "request" ? "request" : "reimbursement"}</p>
            <p className="text-sm mt-2">Klik tombol di atas untuk membuat yang baru</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Reimbursement & Request</h1>
          <p className="text-muted-foreground">Ajukan reimbursement atau request budget untuk kebutuhan Anda</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="reimbursement" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Reimbursement
            </TabsTrigger>
            <TabsTrigger value="request" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Request Budget
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reimbursement" className="space-y-6">
            {renderStatsCards(reimbursementStats, "reimbursement")}
            {renderTable(reimbursements, "reimbursement")}
          </TabsContent>

          <TabsContent value="request" className="space-y-6">
            {renderStatsCards(requestStats, "request")}
            {renderTable(requests, "request")}
          </TabsContent>
        </Tabs>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogType === "reimbursement" ? "Ajukan Reimbursement" : "Ajukan Request Budget"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {dialogType === "request" && (
                <div className="space-y-2">
                  <Label>Judul Request *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Contoh: Pelatihan Digital Marketing"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Kategori *</Label>
                <Select 
                  value={formData.request_from} 
                  onValueChange={(v) => setFormData({ ...formData, request_from: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(dialogType === "request" ? REQUEST_CATEGORIES : REIMBURSEMENT_CATEGORIES).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah (IDR) *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Masukkan jumlah"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project (opsional)</Label>
                  <Select 
                    value={formData.project_id} 
                    onValueChange={(v) => setFormData({ ...formData, project_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Client (opsional)</Label>
                  <Select 
                    value={formData.client_id} 
                    onValueChange={(v) => setFormData({ ...formData, client_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={dialogType === "request" 
                    ? "Jelaskan keperluan dan manfaat request ini" 
                    : "Jelaskan keperluan reimbursement"
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmit}>
                Ajukan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}