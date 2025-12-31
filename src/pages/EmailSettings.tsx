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
import { Mail, Send, CheckCircle, XCircle, Loader2, Settings, History, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const EmailSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [senderEmail, setSenderEmail] = useState("onboarding@resend.dev");
  const [senderName, setSenderName] = useState("Talco System");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch email settings
  const { data: settings, isLoading: loadingSettings, refetch: refetchSettings } = useQuery({
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
  const { data: logs, isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setSenderEmail(settings.smtp_email || "onboarding@resend.dev");
      setSenderName(settings.sender_name || "Talco System");
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const { error } = await supabase
        .from("email_settings")
        .update({
          smtp_email: senderEmail.trim() || "onboarding@resend.dev",
          sender_name: senderName.trim() || "Talco System",
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings?.id);

      if (error) throw error;

      toast({ title: "Berhasil", description: "Pengaturan email berhasil disimpan" });
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
      return true;
    } catch (error: any) {
      console.error("Error saving email settings:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    // Save first before testing
    const saved = await handleSave();
    if (!saved) return;

    setTesting(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("send-notification-email", {
        body: { type: "test" },
      });

      console.log("Test email response:", data, error);

      if (error) {
        throw new Error(error.message || "Failed to invoke email function");
      }
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to send test email");
      }

      setTestResult({ 
        success: true, 
        message: data.message || "Success — Email Service Connected & Ready 🎉" 
      });
      
      toast({ 
        title: "Berhasil! ✅", 
        description: "Test email berhasil dikirim. Cek inbox kamu." 
      });
      
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
      queryClient.invalidateQueries({ queryKey: ["email-logs"] });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      
      const errorMessage = error.message || "Gagal mengirim email";
      setTestResult({ success: false, message: errorMessage });
      
      toast({ 
        title: "Gagal mengirim email", 
        description: errorMessage, 
        variant: "destructive" 
      });
      
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
      queryClient.invalidateQueries({ queryKey: ["email-logs"] });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Terkirim</Badge>;
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
            <p className="text-muted-foreground">Konfigurasi Resend untuk notifikasi email</p>
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
              {/* Configuration Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Konfigurasi Email (Resend)
                  </CardTitle>
                  <CardDescription>
                    Menggunakan Resend untuk pengiriman email yang reliable
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Menggunakan Resend</AlertTitle>
                    <AlertDescription className="text-sm">
                      API Key sudah dikonfigurasi via Secrets. Untuk custom domain, verifikasi di{" "}
                      <a 
                        href="https://resend.com/domains" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-1"
                      >
                        Resend Dashboard <ExternalLink className="h-3 w-3" />
                      </a>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="sender_email">Email Pengirim</Label>
                    <Input
                      id="sender_email"
                      type="email"
                      placeholder="onboarding@resend.dev"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Gunakan <code className="bg-muted px-1 rounded">onboarding@resend.dev</code> untuk testing, atau email dari domain yang sudah diverifikasi.
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
                    <Button 
                      variant="outline" 
                      onClick={handleTestEmail} 
                      disabled={testing}
                    >
                      {testing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Test Email
                    </Button>
                  </div>

                  {/* Test Result Alert */}
                  {testResult && (
                    <Alert variant={testResult.success ? "default" : "destructive"} className="mt-4">
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>{testResult.success ? "Berhasil!" : "Gagal"}</AlertTitle>
                      <AlertDescription className="whitespace-pre-wrap">
                        {testResult.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Status Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Status Koneksi</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => refetchSettings()}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>Status email service</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg border">
                    {settings?.is_connected ? (
                      <>
                        <CheckCircle className="h-10 w-10 text-green-500" />
                        <div>
                          <p className="font-semibold text-lg text-green-600">🟢 Connected</p>
                          <p className="text-sm text-muted-foreground">Resend siap digunakan</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-10 w-10 text-red-500" />
                        <div>
                          <p className="font-semibold text-lg text-red-600">🔴 Not Connected</p>
                          <p className="text-sm text-muted-foreground">Klik Test Email untuk cek koneksi</p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Provider:</span>
                      <span className="font-medium">Resend</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sender:</span>
                      <span className="font-mono text-xs">{senderEmail}</span>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Log Email
                    </CardTitle>
                    <CardDescription>Riwayat pengiriman email notifikasi</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
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
                          <TableHead>Error</TableHead>
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
                            </TableCell>
                            <TableCell className="max-w-xs">
                              {log.error_message && (
                                <p className="text-xs text-red-500 whitespace-pre-wrap">{log.error_message}</p>
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
