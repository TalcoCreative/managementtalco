import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, CheckCircle, XCircle, Loader2, Eye, EyeOff, Settings, History } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EmailSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [smtpEmail, setSmtpEmail] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [senderName, setSenderName] = useState("Talco System");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Fetch email settings
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["email-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch email logs
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setSmtpEmail(settings.smtp_email || "");
      setSmtpPassword(settings.smtp_password || "");
      setSenderName(settings.sender_name || "Talco System");
    }
  }, [settings]);

  const handleSave = async () => {
    if (!smtpEmail.trim()) {
      toast({ title: "Error", description: "Email pengirim harus diisi", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_settings")
        .update({
          smtp_email: smtpEmail.trim(),
          smtp_password: smtpPassword,
          sender_name: senderName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings?.id);

      if (error) throw error;

      toast({ title: "Berhasil", description: "Pengaturan email berhasil disimpan" });
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
    } catch (error: any) {
      console.error("Error saving email settings:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!smtpEmail.trim() || !smtpPassword) {
      toast({ 
        title: "Error", 
        description: "Isi email dan app password terlebih dahulu", 
        variant: "destructive" 
      });
      return;
    }

    // Save first before testing
    await handleSave();

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification-email", {
        body: { type: "test" },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send test email");

      toast({ 
        title: "Berhasil! ✅", 
        description: "Test email berhasil dikirim. Cek inbox kamu." 
      });
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({ 
        title: "Gagal mengirim email", 
        description: error.message, 
        variant: "destructive" 
      });
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-800">Terkirim</Badge>;
      case "failed":
        return <Badge variant="destructive">Gagal</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loadingSettings) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Email Settings</h1>
            <p className="text-muted-foreground">Konfigurasi SMTP untuk notifikasi email</p>
          </div>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Pengaturan
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Log Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <div className="grid gap-6 md:grid-cols-2">
              {/* SMTP Configuration Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Konfigurasi SMTP Gmail
                  </CardTitle>
                  <CardDescription>
                    Masukkan kredensial Gmail untuk mengirim email notifikasi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_email">Email Pengirim</Label>
                    <Input
                      id="smtp_email"
                      type="email"
                      placeholder="your-email@gmail.com"
                      value={smtpEmail}
                      onChange={(e) => setSmtpEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_password">App Password Gmail</Label>
                    <div className="relative">
                      <Input
                        id="smtp_password"
                        type={showPassword ? "text" : "password"}
                        placeholder="xxxx xxxx xxxx xxxx"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Buat App Password di{" "}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Google Account Settings
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sender_name">Nama Pengirim</Label>
                    <Input
                      id="sender_name"
                      placeholder="Talco System"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Simpan
                    </Button>
                    <Button variant="outline" onClick={handleTestEmail} disabled={testing || !smtpEmail || !smtpPassword}>
                      {testing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Test Email
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Status Koneksi</CardTitle>
                  <CardDescription>Status dan informasi SMTP</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {settings?.is_connected ? (
                      <>
                        <CheckCircle className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="font-semibold text-green-600">Connected</p>
                          <p className="text-sm text-muted-foreground">SMTP sudah terkonfigurasi</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-8 w-8 text-red-500" />
                        <div>
                          <p className="font-semibold text-red-600">Not Connected</p>
                          <p className="text-sm text-muted-foreground">SMTP belum dikonfigurasi</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Host:</span>
                      <span className="font-mono">{settings?.smtp_host || "smtp.gmail.com"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Port:</span>
                      <span className="font-mono">{settings?.smtp_port || 587}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Security:</span>
                      <span>TLS</span>
                    </div>
                    {settings?.last_test_at && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Test terakhir:</span>
                        <span>{format(new Date(settings.last_test_at), "dd MMM yyyy HH:mm", { locale: id })}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Notifikasi yang akan dikirim:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>✅ Task Assignment</li>
                      <li>✅ Task Updated</li>
                      <li>✅ Task Completed</li>
                      <li>✅ Task Overdue</li>
                      <li>✅ Project Assignment</li>
                      <li>✅ Shooting Assignment</li>
                      <li>✅ Event Assignment</li>
                      <li>✅ Meeting Invitation</li>
                      <li>✅ Meeting Reminder</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Log Email
                </CardTitle>
                <CardDescription>Riwayat pengiriman email notifikasi</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : logs && logs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Waktu</TableHead>
                          <TableHead>Penerima</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{log.recipient_name || "-"}</p>
                                <p className="text-sm text-muted-foreground">{log.recipient_email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.notification_type}</Badge>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(log.status)}
                              {log.error_message && (
                                <p className="text-xs text-red-500 mt-1">{log.error_message}</p>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Belum ada log email</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default EmailSettings;
