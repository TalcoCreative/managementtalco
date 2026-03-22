import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Link2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  Instagram,
  Facebook,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Lock,
  Key,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const META_PERMISSIONS = [
  { scope: "pages_show_list", description: "List your Facebook Pages" },
  { scope: "pages_manage_metadata", description: "Manage Page-level data" },
  { scope: "pages_manage_posts", description: "Publish content to Pages" },
  { scope: "pages_read_engagement", description: "Read analytics" },
  { scope: "instagram_basic", description: "Access IG account info" },
  { scope: "instagram_content_publish", description: "Publish posts to IG" },
  { scope: "instagram_manage_insights", description: "Read IG analytics" },
];

export default function SocialMediaSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingPages, setIsFetchingPages] = useState(false);

  // Fetch current connection status
  const { data: settings, isLoading } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      try {
        const { data, error } = await supabase.functions.invoke("meta-api", {
          body: { action: "check-connection", user_id: user.id },
        });
        if (error) return { is_connected: false, has_token: false };
        return data;
      } catch {
        return { is_connected: false, has_token: false };
      }
    },
  });

  // Fetch connected accounts
  const { data: connectedAccounts, refetch: refetchAccounts } = useQuery({
    queryKey: ["meta-connected-accounts"],
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

  const handleSaveCredentials = async () => {
    if (!accessToken.trim()) {
      toast.error("Access Token wajib diisi");
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: {
          action: "save-credentials",
          user_id: user.id,
          meta_app_id: appId,
          meta_app_secret: appSecret,
          meta_access_token: accessToken,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.is_connected) {
        toast.success(data.message || "Connected to Meta!");
      } else {
        toast.warning(data.message || "Token saved but verification failed");
      }

      setAccessToken("");
      setAppId("");
      setAppSecret("");
      queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan credentials");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFetchPages = async () => {
    setIsFetchingPages(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "fetch-pages", user_id: user.id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`${data.pages_count || 0} Facebook Pages ditemukan & disinkronkan`);
      refetchAccounts();
    } catch (error: any) {
      toast.error(error.message || "Gagal mengambil Pages");
    } finally {
      setIsFetchingPages(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      await supabase.functions.invoke("meta-api", {
        body: { action: "disconnect", user_id: user.id },
      });

      toast.success("Disconnected from Meta");
      queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["meta-connected-accounts"] });
    } catch (error: any) {
      toast.error(error.message || "Disconnect gagal");
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
              <h1 className="text-3xl font-bold">Meta API Settings</h1>
              <p className="text-muted-foreground">
                Connect directly to Facebook & Instagram via Meta Graph API
              </p>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              This system connects directly to your Meta (Facebook & Instagram) API. No third-party service required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    settings?.is_connected
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : "bg-red-100 dark:bg-red-900/30"
                  }`}
                >
                  {settings?.is_connected ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Meta Graph API</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={settings?.is_connected ? "default" : "secondary"}
                      className={
                        settings?.is_connected
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : ""
                      }
                    >
                      {settings?.is_connected ? "Connected" : "Not Connected"}
                    </Badge>
                    {settings?.user_name && (
                      <span className="text-sm text-muted-foreground">
                        as {settings.user_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {settings?.is_connected && (
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              )}
            </div>

            <Separator />

            {/* Credentials Form */}
            {!settings?.is_connected ? (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Meta Graph API Credentials
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Masukkan credentials dari{" "}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Meta Developer Console
                    </a>
                    . Pastikan app memiliki permission yang dibutuhkan.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appId">App ID (Optional)</Label>
                    <Input
                      id="appId"
                      placeholder="123456789012345"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appSecret">App Secret (Optional)</Label>
                    <div className="relative">
                      <Input
                        id="appSecret"
                        type={showSecret ? "text" : "password"}
                        placeholder="your_app_secret"
                        value={appSecret}
                        onChange={(e) => setAppSecret(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessToken">
                      Page Access Token / User Access Token *
                    </Label>
                    <div className="relative">
                      <Input
                        id="accessToken"
                        type={showToken ? "text" : "password"}
                        placeholder="EAAxxxxxxxx..."
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dapatkan dari Graph API Explorer atau Facebook Login flow
                    </p>
                  </div>

                  <Button onClick={handleSaveCredentials} disabled={isSaving || !accessToken.trim()}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4 mr-2" />
                    )}
                    Save & Verify Token
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                  <h4 className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Connected to Meta Graph API
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your Meta credentials are verified and active. You can now publish content 
                    and view analytics for your Facebook Pages and Instagram accounts.
                  </p>
                </div>

                {/* Fetch Pages Button */}
                <Button onClick={handleFetchPages} disabled={isFetchingPages} className="w-full">
                  {isFetchingPages ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Fetch Facebook Pages & Instagram Accounts
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        {connectedAccounts && connectedAccounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Facebook className="h-5 w-5 text-blue-600" />
                Connected Accounts ({connectedAccounts.length})
              </CardTitle>
              <CardDescription>
                Facebook Pages & Instagram accounts linked via your Meta API token
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {connectedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg text-white ${
                          account.platform === "instagram"
                            ? "bg-gradient-to-r from-purple-500 to-pink-500"
                            : "bg-blue-600"
                        }`}
                      >
                        {account.platform === "instagram" ? (
                          <Instagram className="h-5 w-5" />
                        ) : (
                          <Facebook className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{account.account_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.platform === "instagram"
                            ? "Instagram Business Account"
                            : "Facebook Page"}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Required Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Required Meta Permissions
            </CardTitle>
            <CardDescription>
              Ensure your Meta App has these permissions approved for full functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {META_PERMISSIONS.map((p) => (
                <div
                  key={p.scope}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {p.scope}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{p.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. Create Meta App</h4>
              <p className="text-sm text-muted-foreground">
                Buat app di{" "}
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Meta Developer Console
                </a>{" "}
                dan aktifkan Facebook Login, Instagram Graph API.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">2. Generate Access Token</h4>
              <p className="text-sm text-muted-foreground">
                Dapatkan User Access Token atau Page Access Token dari Graph API Explorer 
                dengan permission yang diperlukan.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">3. Paste & Lock</h4>
              <p className="text-sm text-muted-foreground">
                Masukkan token di halaman ini. Sistem akan memverifikasi dan menyimpan secara aman. 
                Klik "Fetch Pages" untuk sync Facebook Pages & Instagram accounts.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">4. Publish & Monitor</h4>
              <p className="text-sm text-muted-foreground">
                Buat post, jadwalkan konten, dan monitor analytics langsung dari dashboard. 
                Semua melalui Meta Graph API langsung — tanpa perantara.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
