import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Instagram, Facebook, Link2, Unlink, AlertCircle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";

const platformConfig = {
  instagram: {
    name: "Instagram",
    icon: Instagram,
    color: "bg-gradient-to-r from-purple-500 to-pink-500",
    description: "Connect Instagram Business Account via SocialBu",
  },
  facebook: {
    name: "Facebook",
    icon: Facebook,
    color: "bg-blue-600",
    description: "Connect Facebook Page via SocialBu",
  },
  twitter: {
    name: "X (Twitter)",
    icon: null,
    color: "bg-black",
    description: "Connect X/Twitter Account via SocialBu",
  },
  tiktok: {
    name: "TikTok",
    icon: null,
    color: "bg-black",
    description: "Connect TikTok Business Account via SocialBu",
  },
  linkedin: {
    name: "LinkedIn",
    icon: null,
    color: "bg-blue-700",
    description: "Connect LinkedIn Profile/Page via SocialBu",
  },
  youtube: {
    name: "YouTube",
    icon: null,
    color: "bg-red-600",
    description: "Connect YouTube Channel via SocialBu",
  },
};

export function SocialMediaAccounts() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Fetch SocialBu settings
  const { data: settings } = useQuery({
    queryKey: ["social-media-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as (typeof data & { auth_token?: string; is_connected?: boolean }) | null;
    },
  });

  // Fetch SocialBu connected accounts
  const { data: accounts, isLoading } = useQuery({
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

  // Refresh accounts from SocialBu
  const handleRefresh = async () => {
    if (!settings?.is_connected) {
      toast.error("SocialBu belum terhubung. Silakan login di Settings.");
      return;
    }

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("socialbu-accounts", {
        body: { action: "fetch-accounts" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`${data.accounts?.length || 0} akun ditemukan dan disinkronkan`);
      queryClient.invalidateQueries({ queryKey: ["socialbu-accounts"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal mengambil akun");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Connect new account via SocialBu
  const handleConnect = async (platform: string) => {
    if (!settings?.is_connected) {
      toast.error("SocialBu belum terhubung. Silakan login di Settings terlebih dahulu.");
      return;
    }

    setConnectingPlatform(platform);
    try {
      const { data, error } = await supabase.functions.invoke("socialbu-accounts", {
        body: { action: "connect-account", provider: platform },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.connect_url) {
        window.open(data.connect_url, "Connect Social Account", "width=600,height=700");
        toast.info("Silakan selesaikan proses di popup yang terbuka, lalu klik Refresh");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal menghubungkan akun");
    } finally {
      setConnectingPlatform(null);
    }
  };

  const isConnected = settings?.is_connected;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {!isConnected && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-700 dark:text-amber-400">SocialBu Belum Terhubung</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Untuk menghubungkan akun social media, silakan login ke SocialBu terlebih dahulu di halaman Settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-700 dark:text-green-400">SocialBu Terhubung</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Anda dapat menghubungkan dan mengelola akun social media.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(platformConfig).map(([key, config]) => {
          const connectedAccount = accounts?.find(a => a.platform === key);
          const Icon = config.icon;
          const isConnecting = connectingPlatform === key;

          return (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg text-white ${config.color}`}>
                    {Icon ? <Icon className="h-6 w-6" /> : <span className="text-lg font-bold">{config.name[0]}</span>}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{config.name}</CardTitle>
                    <CardDescription className="text-xs">{config.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {connectedAccount ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        Terhubung
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{connectedAccount.account_name || "Account"}</p>
                      {connectedAccount.profile_image_url && (
                        <img 
                          src={connectedAccount.profile_image_url} 
                          alt={connectedAccount.account_name || ""} 
                          className="w-8 h-8 rounded-full mt-2"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-muted-foreground">
                        Belum Terhubung
                      </Badge>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full"
                      onClick={() => handleConnect(key)}
                      disabled={!isConnected || isConnecting}
                    >
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Hubungkan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connected Accounts Summary */}
      {accounts && accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Semua Akun Terhubung ({accounts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accounts.map((account) => {
                const config = platformConfig[account.platform as keyof typeof platformConfig];
                const Icon = config?.icon;

                return (
                  <div 
                    key={account.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg text-white ${config?.color || "bg-gray-500"}`}>
                        {Icon ? <Icon className="h-4 w-4" /> : <span className="font-bold text-sm">{(config?.name || account.platform)[0]}</span>}
                      </div>
                      <div>
                        <p className="font-medium">{account.account_name || config?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{account.platform}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/10 text-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
