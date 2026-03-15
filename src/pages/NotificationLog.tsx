import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Send, MessageSquare, Filter, Phone, Settings } from "lucide-react";
import { sendTestWhatsApp } from "@/lib/whatsapp-utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import WASettingsTab from "@/components/whatsapp/WASettingsTab";

export default function NotificationLog() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["notification-logs", search, statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("notification_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(500);

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (dateFrom) {
        query = query.gte("sent_at", `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte("sent_at", `${dateTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const userIds = [...new Set((logs || []).map((l: any) => l.user_id).filter(Boolean))];
  const { data: profiles } = useQuery({
    queryKey: ["notif-log-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

  const filteredLogs = (logs || []).filter((log: any) => {
    if (!search) return true;
    const name = profileMap.get(log.user_id) || "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      log.phone_number?.toLowerCase().includes(search.toLowerCase()) ||
      log.message?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleTestSend = async () => {
    if (!testPhone || !testMessage) {
      toast.error("Nomor dan pesan harus diisi");
      return;
    }
    setSending(true);
    try {
      await sendTestWhatsApp(testPhone, testMessage);
      toast.success("Test WhatsApp terkirim!");
      refetch();
    } catch (err: any) {
      toast.error("Gagal mengirim: " + (err.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "invalid_number":
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20">Invalid Number</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">WhatsApp Notification</h1>
            <p className="text-sm text-muted-foreground mt-1">Kelola notifikasi WhatsApp via Fonnte</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Send className="h-4 w-4" />
                Send Test WhatsApp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Test WhatsApp Message</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nomor (format 08)</label>
                  <Input placeholder="08xxxxxxxxxx" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Pesan</label>
                  <Textarea placeholder="Isi pesan WhatsApp..." value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={4} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Batal</Button>
                </DialogClose>
                <Button onClick={handleTestSend} disabled={sending} className="gap-2">
                  <Send className="h-4 w-4" />
                  {sending ? "Mengirim..." : "Kirim Test"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="log" className="w-full">
          <TabsList>
            <TabsTrigger value="log" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Log
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="space-y-6 mt-4">
            {/* Filters */}
            <Card className="rounded-2xl border-border/30">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Cari user, nomor, atau pesan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="invalid_number">Invalid Number</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-40" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-40" />
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total", value: logs?.length || 0, icon: MessageSquare, color: "text-primary" },
                { label: "Success", value: (logs || []).filter((l: any) => l.status === "success").length, icon: Send, color: "text-emerald-500" },
                { label: "Failed", value: (logs || []).filter((l: any) => l.status === "failed").length, icon: Filter, color: "text-destructive" },
                { label: "Invalid", value: (logs || []).filter((l: any) => l.status === "invalid_number").length, icon: Phone, color: "text-amber-500" },
              ].map((stat) => (
                <Card key={stat.label} className="rounded-2xl border-border/30">
                  <CardContent className="p-4 flex items-center gap-3">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-lg font-bold">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Table */}
            <Card className="rounded-2xl border-border/30">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>No. WhatsApp</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="hidden md:table-cell">Pesan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Waktu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                      </TableRow>
                    ) : filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada notifikasi WhatsApp</TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{profileMap.get(log.user_id) || "Test User"}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{log.phone_number || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{log.event_type?.replace(/_/g, " ")}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell max-w-[300px] truncate text-xs text-muted-foreground">{log.message}</TableCell>
                          <TableCell>{statusBadge(log.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {log.sent_at ? format(new Date(log.sent_at), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <WASettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
