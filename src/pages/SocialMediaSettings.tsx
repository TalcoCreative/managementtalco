import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Share2,
  Settings,
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  Instagram,
  Facebook,
  User,
  LogIn,
  LogOut,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const platformConfig = {
  instagram: { name: "Instagram", icon: Instagram, color: "bg-gradient-to-r from-purple-500 to-pink-500" },
  facebook: { name: "Facebook", icon: Facebook, color: "bg-blue-600" },
  twitter: { name: "X (Twitter)", icon: null, color: "bg-black" },
  tiktok: { name: "TikTok", icon: null, color: "bg-black" },
  linkedin: { name: "LinkedIn", icon: null, color: "bg-blue-700" },
  youtube: { name: "YouTube", icon: null, color: "bg-red-600" },
};

export default function SocialMediaSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  // Fetch current settings and connection status
  const { data: settings, isLoading, refetch: refetchSettings } = useQuery({
    queryKey: ["social-media-settings"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      // Check connection status via edge function
      const { data: connectionData } = await supabase.functions.invoke("socialbu-accounts", {
        body: { action: "check-connection" },
      });

      // Also fetch from DB for additional info
      const { data, error } = await supabase
        .from("social_media_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...(data || {}),
        is_connected: connectionData?.is_connected || false,
        has_api_key: connectionData?.has_api_key || false,
        last_sync_at: connectionData?.last_sync_at || data?.last_sync_at,
      };
    },
  });

  // Fetch SocialBu connected accounts
  const { data: socialbuAccounts, refetch: refetchAccounts } = useQuery({
    queryKey: ["socialbu-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("socialbu_accounts")
        .select("*")
        .eq("is_active", true)
        .order("platform");
      if (error) throw error;
      return data;
    },
  });

  // Save API Key
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Masukkan API Key SocialBu");
      return;
    }

    setIsSavingApiKey(true);
    try {
      const { data, error } = await supabase.functions.invoke("socialbu-accounts", {
        body: { action: "save-api-key", api_key: apiKey },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("API Key berhasil disimpan!");
      setApiKey("");
      refetchSettings();
      
      // Fetch accounts after saving API key
      await fetchSocialBuAccounts();
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan API Key");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  // Logout from SocialBu
  const handleLogout = async () => {
    try {
      const { error } = await supabase.functions.invoke("socialbu-accounts", {
        body: { action: "logout" },
      });

      if (error) throw error;
      toast.success("Berhasil logout dari SocialBu");
      queryClient.invalidateQueries({ queryKey: ["social-media-settings"] });
      queryClient.invalidateQueries({ queryKey: ["socialbu-accounts"] });
    } catch (error: any) {
      toast.error(error.message || "Logout gagal");
    }
  };

  // Fetch connected accounts from SocialBu
  const fetchSocialBuAccounts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("socialbu-accounts", {
        body: { action: "fetch-accounts" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`${data.accounts?.length || 0} akun ditemukan`);
      refetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Gagal mengambil akun");
    }
  };

  // Connect new social account
  const handleConnectAccount = async (provider: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("socialbu-accounts", {
        body: { action: "connect-account", provider },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.connect_url) {
        // Open in popup
        window.open(data.connect_url, "Connect Social Account", "width=600,height=700");
        toast.info("Silakan selesaikan proses di popup yang terbuka");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal connect akun");
    }
  };

  // Sync posts from SocialBu
  const handleSync = async () => {
    if (!settings?.is_connected) {
      toast.error("SocialBu belum terkoneksi");
      return;
    }

    setIsSyncing(true);
    try {
      // Get current user ID
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        toast.error("User tidak terautentikasi");
        return;
      }

      const { data, error } = await supabase.functions.invoke("sync-socialbu", {
        body: { action: "sync", user_id: userId },
      });

      if (error) throw error;

      toast.success(`Sync berhasil! ${data?.synced || 0} posts diupdate.`);
      queryClient.invalidateQueries({ queryKey: ["social-media-settings"] });
      queryClient.invalidateQueries({ queryKey: ["social-media-posts"] });
    } catch (error: any) {
      toast.error("Sync gagal: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/social-media")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Social Media Settings</h1>
              <p className="text-muted-foreground">Konfigurasi integrasi SocialBu</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="connection">Koneksi</TabsTrigger>
            <TabsTrigger value="accounts">Akun Sosial</TabsTrigger>
            <TabsTrigger value="sync">Sync & Data</TabsTrigger>
          </TabsList>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  SocialBu Integration
                </CardTitle>
                <CardDescription>
                  Hubungkan akun SocialBu untuk posting dan analytics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connection Status */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      settings?.is_connected ? "bg-green-100" : "bg-red-100"
                    }`}>
                      {settings?.is_connected ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Status Koneksi</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={settings?.is_connected ? "default" : "secondary"}>
                          {settings?.is_connected ? "Connected" : "Not Connected"}
                        </Badge>
                        {settings?.user_email && (
                          <span className="text-sm text-muted-foreground">
                            ({settings.user_email})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {settings?.is_connected && (
                    <Button variant="outline" size="sm" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  )}
                </div>

                <Separator />

                {/* API Key Form */}
                {!settings?.is_connected ? (
                  <div className="space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Hubungkan dengan API Key
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Dapatkan API Key dari <a href="https://socialbu.com/app/settings/developer" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">SocialBu Developer Settings</a>, 
                        lalu paste di bawah ini.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key / Access Token</Label>
                        <div className="relative">
                          <Input
                            id="apiKey"
                            type={showApiKey ? "text" : "password"}
                            placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOi..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <Button onClick={handleSaveApiKey} disabled={isSavingApiKey}>
                        {isSavingApiKey ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4 mr-2" />
                        )}
                        Simpan API Key
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                    <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Terhubung
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Anda sudah terhubung ke SocialBu. Anda dapat membuat post, menjadwalkan konten, 
                      dan melihat analytics langsung dari aplikasi ini.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Akun Social Media</CardTitle>
                  <CardDescription>Akun yang terhubung melalui SocialBu</CardDescription>
                </div>
                {settings?.is_connected && (
                  <Button variant="outline" size="sm" onClick={fetchSocialBuAccounts}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!settings?.is_connected ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Login ke SocialBu terlebih dahulu untuk melihat akun yang terhubung</p>
                  </div>
                ) : socialbuAccounts?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Belum ada akun social media yang terhubung</p>
                    <p className="text-sm mt-2">
                      Hubungkan akun di dashboard SocialBu atau gunakan tombol di bawah
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {socialbuAccounts?.map((account) => {
                      const config = platformConfig[account.platform as keyof typeof platformConfig];
                      const Icon = config?.icon;

                      return (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg text-white ${config?.color || "bg-gray-500"}`}>
                              {Icon ? <Icon className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="font-medium">{account.account_name || config?.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{account.platform}</p>
                            </div>
                          </div>
                          <Badge className="bg-green-500/10 text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}

                {settings?.is_connected && (
                  <>
                    <Separator className="my-6" />
                    <div className="space-y-4">
                      <h4 className="font-medium">Tambah Akun Baru</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(platformConfig).map(([key, config]) => {
                          const Icon = config.icon;
                          return (
                            <Button
                              key={key}
                              variant="outline"
                              size="sm"
                              className="justify-start"
                              onClick={() => handleConnectAccount(key)}
                            >
                              <div className={`p-1 rounded mr-2 text-white ${config.color}`}>
                                {Icon ? <Icon className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                              </div>
                              {config.name}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync Tab */}
          <TabsContent value="sync" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Sinkronisasi Data</CardTitle>
                <CardDescription>Sync posts dan analytics dari SocialBu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Last Sync */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Last Sync</p>
                      <p className="text-sm text-muted-foreground">
                        {settings?.last_sync_at
                          ? format(new Date(settings.last_sync_at), "dd MMM yyyy HH:mm")
                          : "Belum pernah sync"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing || !settings?.is_connected}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg">
                  <h4 className="font-medium text-amber-700 dark:text-amber-400">Info Sync</h4>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Posts: Mengambil post scheduled dan published dari SocialBu</li>
                    <li>Analytics: Mengambil metrics (views, likes, comments, dll)</li>
                    <li>Accounts: Mengupdate status akun yang terhubung</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* How it works */}
            <Card>
              <CardHeader>
                <CardTitle>Cara Kerja</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">1. Login SocialBu</h4>
                  <p className="text-sm text-muted-foreground">
                    Masukkan email dan password akun SocialBu untuk mengaktifkan integrasi.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">2. Hubungkan Akun Social Media</h4>
                  <p className="text-sm text-muted-foreground">
                    Hubungkan Instagram, Facebook, TikTok, dan platform lainnya melalui SocialBu.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">3. Buat & Jadwalkan Post</h4>
                  <p className="text-sm text-muted-foreground">
                    Buat post baru, jadwalkan waktu posting, dan upload media langsung dari sini.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">4. Monitor Analytics</h4>
                  <p className="text-sm text-muted-foreground">
                    Lihat performa post: views, likes, comments, shares, dan metrics lainnya.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
