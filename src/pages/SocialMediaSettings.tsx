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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Settings,
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
  ExternalLink,
  Copy,
  AlertTriangle,
  BookOpen,
  Globe,
  Zap,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const META_PERMISSIONS = [
  { scope: "pages_show_list", description: "List all Facebook Pages you manage", required: true },
  { scope: "pages_manage_metadata", description: "Manage Page metadata and settings", required: true },
  { scope: "pages_manage_posts", description: "Create, edit, and delete Page posts", required: true },
  { scope: "pages_read_engagement", description: "Read Page likes, comments, shares", required: true },
  { scope: "pages_read_user_content", description: "Read user-generated content on Pages", required: false },
  { scope: "instagram_basic", description: "Access Instagram account profile info", required: true },
  { scope: "instagram_content_publish", description: "Publish photos & videos to Instagram", required: true },
  { scope: "instagram_manage_insights", description: "Read Instagram reach, impressions, engagement", required: true },
  { scope: "instagram_manage_comments", description: "Read and manage Instagram comments", required: false },
  { scope: "business_management", description: "Manage business assets and Pages", required: false },
];

const TUTORIAL_STEPS = [
  {
    id: "create-app",
    title: "Step 1: Buat Meta App di Developer Console",
    icon: Globe,
    content: [
      "1. Buka **https://developers.facebook.com/apps** dan login dengan akun Facebook kamu",
      "2. Klik **\"Create App\"** (tombol hijau di kanan atas)",
      "3. Pilih **\"Other\"** lalu klik Next",
      "4. Pilih tipe app: **\"Business\"** → klik Next",
      "5. Isi nama app (contoh: \"Talco Social Manager\"), pilih Business Portfolio, lalu klik **Create App**",
      "6. App berhasil dibuat! Catat **App ID** yang muncul di halaman dashboard",
    ],
  },
  {
    id: "add-products",
    title: "Step 2: Tambahkan Facebook Login & Instagram API",
    icon: Zap,
    content: [
      "1. Di sidebar kiri, klik **\"Add Product\"**",
      "2. Cari **\"Facebook Login\"** → klik **\"Set Up\"** → pilih **\"Web\"**",
      "3. Masukkan Site URL: **https://ms.talco.id** → klik Save",
      "4. Kembali ke **\"Add Product\"**, cari **\"Instagram Graph API\"** → klik **\"Set Up\"**",
      "5. Di sidebar kiri sekarang akan muncul: Facebook Login dan Instagram Graph API",
    ],
  },
  {
    id: "permissions",
    title: "Step 3: Konfigurasi Permissions",
    icon: ShieldCheck,
    content: [
      "1. Di sidebar, buka **App Review → Permissions and Features**",
      "2. Untuk setiap permission berikut, klik **\"Request Advanced Access\"**:",
      "   • `pages_show_list` — Wajib untuk melihat daftar Pages",
      "   • `pages_manage_posts` — Wajib untuk posting konten",
      "   • `pages_read_engagement` — Wajib untuk analytics",
      "   • `instagram_basic` — Wajib untuk akses akun IG",
      "   • `instagram_content_publish` — Wajib untuk posting ke IG",
      "   • `instagram_manage_insights` — Wajib untuk analytics IG",
      "3. Beberapa permission memerlukan **App Review** dari Meta (submit screencast)",
      "4. Untuk testing, kamu bisa pakai **Standard Access** dulu dengan akun test",
    ],
  },
  {
    id: "generate-token",
    title: "Step 4: Generate Access Token",
    icon: Key,
    content: [
      "**Cara Cepat via Graph API Explorer:**",
      "1. Buka **https://developers.facebook.com/tools/explorer/**",
      "2. Pilih app kamu di dropdown \"Meta App\"",
      "3. Klik **\"Generate Access Token\"**",
      "4. Centang semua permissions yang dibutuhkan (lihat daftar di atas)",
      "5. Klik **\"Generate Access Token\"** → Login dan izinkan",
      "6. Copy token yang muncul",
      "",
      "**⚠️ PENTING: Token ini adalah Short-Lived Token (berlaku ~1 jam)**",
      "",
      "**Untuk Long-Lived Token (berlaku ~60 hari):**",
      "1. Buka **App Settings → Basic** di Developer Console",
      "2. Catat **App Secret** (klik Show, masukkan password)",
      "3. Buka URL berikut di browser (ganti placeholder):",
      "```",
      "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN",
      "```",
      "4. Response akan berisi `access_token` yang berlaku ~60 hari",
      "",
      "**Untuk Page Access Token (Tidak Expire):**",
      "1. Setelah punya Long-Lived User Token, panggil:",
      "```",
      "https://graph.facebook.com/v19.0/me/accounts?access_token=LONG_LIVED_TOKEN",
      "```",
      "2. Setiap Page akan punya `access_token` sendiri yang **tidak expire**",
      "3. Kamu bisa juga pakai User Token langsung (kami akan fetch Page tokens otomatis)",
    ],
  },
  {
    id: "paste-lock",
    title: "Step 5: Paste Token & Lock",
    icon: Lock,
    content: [
      "1. Paste token di form di atas (Access Token field)",
      "2. Opsional: masukkan App ID dan App Secret untuk fitur tambahan",
      "3. Klik **\"Save & Verify Token\"**",
      "4. Sistem akan memverifikasi token ke Meta API langsung",
      "5. Jika valid, klik **\"Fetch Facebook Pages & Instagram\"** untuk sync akun",
      "6. Semua Facebook Pages dan Instagram Business accounts yang terhubung akan muncul",
      "",
      "**Tips:**",
      "• Pastikan akun Instagram sudah di-set sebagai **Business Account** atau **Creator Account**",
      "• Instagram harus terhubung ke **Facebook Page** (Settings → Linked Accounts)",
      "• Jika ada banyak Pages, semuanya akan otomatis ter-sync",
    ],
  },
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

  const { data: connectedAccounts, refetch: refetchAccounts } = useQuery({
    queryKey: ["meta-connected-accounts-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_accounts")
        .select("*")
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

      const igCount = data.ig_count || 0;
      toast.success(
        `Sync selesai: ${data.pages_count || 0} Facebook Pages & ${igCount} Instagram accounts`
      );
      refetchAccounts();
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
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
      queryClient.invalidateQueries({ queryKey: ["meta-connected-accounts-settings"] });
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    } catch (error: any) {
      toast.error(error.message || "Disconnect gagal");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
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
                Connect directly to Facebook & Instagram via Meta Graph API — No third-party required
              </p>
            </div>
          </div>
        </div>

        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Direct integration with Meta Graph API v19.0+
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center ${
                    settings?.is_connected
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : "bg-red-100 dark:bg-red-900/30"
                  }`}
                >
                  {settings?.is_connected ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-lg">Meta Graph API</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      className={
                        settings?.is_connected
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }
                    >
                      {settings?.is_connected ? "✓ Connected" : "✗ Not Connected"}
                    </Badge>
                    {settings?.user_name && (
                      <span className="text-sm text-muted-foreground">
                        Logged in as <strong>{settings.user_name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {settings?.is_connected && (
                <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-destructive">
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
                    Masukkan Meta API Credentials
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Dapatkan credentials dari{" "}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline font-medium"
                    >
                      Meta Developer Console ↗
                    </a>
                    . Lihat tutorial lengkap di bawah.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appId">
                      App ID <span className="text-xs text-muted-foreground">(Opsional, untuk extend token)</span>
                    </Label>
                    <Input
                      id="appId"
                      placeholder="contoh: 123456789012345"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Temukan di Meta Developer Console → App Settings → Basic → App ID
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appSecret">
                      App Secret <span className="text-xs text-muted-foreground">(Opsional, untuk extend token)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="appSecret"
                        type={showSecret ? "text" : "password"}
                        placeholder="contoh: a1b2c3d4e5f6..."
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
                    <p className="text-xs text-muted-foreground">
                      App Settings → Basic → App Secret (klik Show, masukkan password Facebook)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessToken" className="flex items-center gap-1">
                      Access Token <span className="text-destructive">*</span>
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
                      User Access Token atau Page Access Token dari Graph API Explorer
                    </p>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-sm text-amber-700 dark:text-amber-400">
                        <p className="font-medium">Tips Token</p>
                        <ul className="text-xs mt-1 space-y-1 text-muted-foreground">
                          <li>• <strong>Short-Lived Token</strong> dari Graph API Explorer berlaku ~1 jam</li>
                          <li>• <strong>Long-Lived Token</strong> berlaku ~60 hari (extend via App ID + Secret)</li>
                          <li>• <strong>Page Token</strong> dari Long-Lived User Token tidak pernah expire</li>
                          <li>• Jika pakai App ID & Secret, sistem akan otomatis extend token</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveCredentials} disabled={isSaving || !accessToken.trim()} size="lg">
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
                    Credentials verified. Klik tombol di bawah untuk sync semua Facebook Pages dan Instagram accounts.
                  </p>
                </div>

                <Button onClick={handleFetchPages} disabled={isFetchingPages} className="w-full" size="lg">
                  {isFetchingPages ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Fetch & Sync All Facebook Pages & Instagram Accounts
                </Button>

                {settings?.token_expires_at && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      Token expires: {new Date(settings.token_expires_at).toLocaleDateString("id-ID", {
                        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </div>
                  </div>
                )}
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
                Synced Accounts ({connectedAccounts.length})
              </CardTitle>
              <CardDescription>
                Semua Facebook Pages & Instagram accounts yang ter-sync dari Meta API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {connectedAccounts.map((account: any) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/40"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl text-white ${
                          account.platform === "instagram"
                            ? "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500"
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
                        <p className="font-medium">{account.account_name || account.platform}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.platform === "instagram"
                            ? "Instagram Business"
                            : "Facebook Page"}
                          {account.page_id && (
                            <span className="ml-1 font-mono text-[10px]">
                              ID: {account.page_id}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Synced
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
              Meta API Permissions
            </CardTitle>
            <CardDescription>
              Pastikan app kamu memiliki permissions berikut di Meta Developer Console
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {META_PERMISSIONS.map((p) => (
                <div
                  key={p.scope}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="font-mono text-xs cursor-pointer hover:bg-primary/10"
                      onClick={() => copyToClipboard(p.scope)}
                    >
                      {p.scope}
                      <Copy className="h-3 w-3 ml-1 opacity-50" />
                    </Badge>
                    {p.required && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        REQUIRED
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{p.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Comprehensive Tutorial */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Tutorial Lengkap: Setup Meta API
            </CardTitle>
            <CardDescription>
              Panduan step-by-step untuk menghubungkan Facebook Pages & Instagram Business ke sistem ini
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Quick Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
              >
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Developer Console</span>
                <ExternalLink className="h-3 w-3 ml-auto text-blue-500" />
              </a>
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors"
              >
                <Key className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Graph API Explorer</span>
                <ExternalLink className="h-3 w-3 ml-auto text-purple-500" />
              </a>
              <a
                href="https://developers.facebook.com/docs/graph-api/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                <BookOpen className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">API Documentation</span>
                <ExternalLink className="h-3 w-3 ml-auto text-emerald-500" />
              </a>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {TUTORIAL_STEPS.map((step, idx) => (
                <AccordionItem key={step.id} value={step.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-left">{step.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-11 space-y-2">
                      {step.content.map((line, i) => {
                        if (line === "") return <br key={i} />;
                        if (line.startsWith("```")) {
                          return null; // skip code fence markers
                        }
                        // Check if previous line was ``` (code block content)
                        const prevLine = step.content[i - 1];
                        const nextLine = step.content[i + 1];
                        if (prevLine === "```" && nextLine === "```") {
                          return (
                            <div key={i} className="relative group">
                              <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">
                                {line}
                              </pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => copyToClipboard(line)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        }
                        // Bold text rendering
                        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
                        return (
                          <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                            {parts.map((part, j) => {
                              if (part.startsWith("**") && part.endsWith("**")) {
                                return <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>;
                              }
                              if (part.startsWith("`") && part.endsWith("`")) {
                                return (
                                  <code key={j} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                                    {part.slice(1, -1)}
                                  </code>
                                );
                              }
                              return part;
                            })}
                          </p>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Troubleshooting & FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                {
                  q: "Token expired / Invalid token",
                  a: "Short-lived token berlaku ~1 jam. Generate ulang di Graph API Explorer, atau masukkan App ID + Secret untuk extend otomatis ke Long-Lived Token.",
                },
                {
                  q: "Instagram account tidak muncul",
                  a: "Pastikan Instagram sudah di-switch ke Business Account atau Creator Account, DAN sudah di-link ke Facebook Page (Instagram Settings → Linked Accounts → Facebook).",
                },
                {
                  q: "Hanya muncul beberapa Pages",
                  a: "Pastikan saat generate token, kamu centang semua Pages yang ingin dikelola. Atau pastikan kamu admin/editor di Page tersebut.",
                },
                {
                  q: "Error 'permissions not granted'",
                  a: "Beberapa permission memerlukan App Review dari Meta. Untuk testing, pastikan kamu menggunakan akun yang terdaftar sebagai tester/developer di app.",
                },
                {
                  q: "Bagaimana cara menambah orang lain sebagai tester?",
                  a: "Di Developer Console → App Roles → Roles → Add People. Masukkan Facebook ID atau email orang tersebut dan pilih role 'Tester'.",
                },
              ].map((faq, i) => (
                <div key={i} className="p-4 bg-muted/50 rounded-lg border border-border/30">
                  <p className="font-medium text-sm">{faq.q}</p>
                  <p className="text-sm text-muted-foreground mt-1">{faq.a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
