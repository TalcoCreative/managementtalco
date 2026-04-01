import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Instagram,
  Facebook,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useSocialAccounts, useSocialModuleConfig } from "@/hooks/useSocialModule";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

const META_PERMISSIONS = [
  { scope: "pages_show_list", description: "List your Facebook Pages" },
  { scope: "pages_manage_posts", description: "Publish content to Pages" },
  { scope: "pages_read_engagement", description: "Read Page engagement analytics" },
  { scope: "instagram_basic", description: "Access Instagram account info" },
  { scope: "instagram_content_publish", description: "Publish posts to Instagram" },
  { scope: "instagram_manage_insights", description: "Read Instagram analytics" },
];

export function SocialAccountsTab() {
  const { data: accounts, isLoading, connectAccount, disconnectAccount } = useSocialAccounts();
  const { config } = useSocialModuleConfig();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("instagram");
  const [accountName, setAccountName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dummy mode: simulate connect
  const handleDummyConnect = async () => {
    if (!accountName.trim()) return;
    setConnecting(true);
    await new Promise((r) => setTimeout(r, 1500));
    await connectAccount.mutateAsync({ platform, accountName });
    setConnecting(false);
    setOpen(false);
    setAccountName("");
  };

  // Live mode: fetch real accounts from Meta API
  const handleLiveSync = async () => {
    setSyncing(true);
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
        `Sync selesai: ${data.pages_count || 0} Facebook Pages & ${igCount} Instagram accounts ditemukan`
      );
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    } catch (error: any) {
      if (error.message?.includes("not configured")) {
        toast.error("Meta API belum dikonfigurasi. Silakan setup di Settings terlebih dahulu.", {
          action: {
            label: "Go to Settings",
            onClick: () => navigate("/social-media/settings"),
          },
        });
      } else {
        toast.error(error.message || "Gagal sync akun dari Meta");
      }
    } finally {
      setSyncing(false);
    }
  };

  const connected = accounts?.filter(
    (a: any) => a.status === "connected" || a.is_connected === true
  );
  const disconnected = accounts?.filter(
    (a: any) => a.status === "disconnected" || a.is_connected === false
  );

  return (
    <div className="space-y-6">
      {/* Meta Permissions Info */}
      <Card className="border-blue-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            Meta API Permissions Used
          </CardTitle>
          <CardDescription className="text-xs">
            {config.mode === "live"
              ? "Connected via Meta Graph API. Accounts are synced from your real Facebook Pages & Instagram."
              : "Demo mode: Accounts are simulated. Switch to Live mode and configure Meta API in Settings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {META_PERMISSIONS.map((p) => (
              <Badge key={p.scope} variant="outline" className="text-xs font-mono">
                {p.scope}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wifi className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{connected?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <WifiOff className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{disconnected?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Disconnected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/50 flex items-center justify-center">
                <Facebook className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accounts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connect / Sync Buttons */}
      <div className="flex justify-end gap-2">
        {config.mode === "live" ? (
          <>
            <Button variant="outline" onClick={() => navigate("/social-media/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              API Settings
            </Button>
            <Button onClick={handleLiveSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from Meta API
            </Button>
          </>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Connect Facebook / Instagram
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Facebook Page or Instagram Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {connecting ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="font-medium">
                        Connecting to {platform === "instagram" ? "Instagram" : "Facebook"}...
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Authenticating via Facebook Login (OAuth 2.0)
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Demo mode: Simulate connecting a Facebook Page or Instagram Business account.
                    </p>
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="facebook">
                            <span className="flex items-center gap-2">
                              <Facebook className="h-4 w-4 text-blue-600" />
                              Facebook Page
                            </span>
                          </SelectItem>
                          <SelectItem value="instagram">
                            <span className="flex items-center gap-2">
                              <Instagram className="h-4 w-4 text-pink-500" />
                              Instagram Business Account
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {platform === "facebook" ? "Page Name" : "Instagram Account Name"}
                      </Label>
                      <Input
                        placeholder={
                          platform === "facebook"
                            ? "e.g. My Business Page"
                            : "e.g. @mybusiness"
                        }
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleDummyConnect} className="w-full" disabled={!accountName.trim()}>
                      <Facebook className="h-4 w-4 mr-2" />
                      Continue with Facebook
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Demo mode: Account will be simulated instantly
                    </p>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Live mode: no accounts message */}
      {config.mode === "live" && (!accounts || accounts.length === 0) && !isLoading && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6 text-center py-12">
            <Settings className="h-12 w-12 mx-auto mb-4 text-amber-500/50" />
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Belum ada akun yang tersync
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Konfigurasi Meta API di Settings terlebih dahulu, lalu klik "Sync from Meta API" untuk mengambil semua Facebook Pages & Instagram accounts kamu.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/social-media/settings")}
            >
              <Settings className="h-4 w-4 mr-2" />
              Setup Meta API
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 h-32" />
            </Card>
          ))
        ) : (
          accounts?.map((account: any) => {
            const isConnected = account.status === "connected" || account.is_connected === true;
            const name = account.account_name || account.platform;
            return (
              <Card key={account.id} className="relative overflow-hidden">
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    account.platform === "instagram"
                      ? "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"
                      : "bg-blue-600"
                  }`}
                />
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={account.avatar_url} />
                        <AvatarFallback>
                          {account.platform === "instagram" ? (
                            <Instagram className="h-5 w-5" />
                          ) : (
                            <Facebook className="h-5 w-5" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.platform === "instagram"
                            ? "Instagram Business"
                            : "Facebook Page"}
                        </p>
                        {account.followers_count && (
                          <p className="text-xs text-muted-foreground">
                            {account.followers_count.toLocaleString()} followers
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      className={
                        isConnected
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }
                    >
                      {isConnected ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {isConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex justify-end">
                    {isConnected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive"
                        onClick={() => disconnectAccount.mutate(account.id)}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
