import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Instagram, Facebook, Link2, Unlink, AlertCircle, CheckCircle2 } from "lucide-react";

const platformConfig = {
  instagram: {
    name: "Instagram",
    icon: Instagram,
    color: "bg-gradient-to-r from-purple-500 to-pink-500",
    description: "Connect Instagram Business Account via Facebook",
  },
  facebook: {
    name: "Facebook",
    icon: Facebook,
    color: "bg-blue-600",
    description: "Connect Facebook Page",
  },
  tiktok: {
    name: "TikTok",
    icon: null,
    color: "bg-black",
    description: "Connect TikTok Business Account",
  },
};

export function SocialMediaAccounts() {
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user || null;
    },
  });

  // Fetch connected accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["social-media-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_accounts")
        .select("*")
        .order("platform");
      if (error) throw error;
      return data;
    },
  });

  const disconnectAccount = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from("social_media_accounts")
        .delete()
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Akun berhasil diputus");
      queryClient.invalidateQueries({ queryKey: ["social-media-accounts"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Gagal memutus akun");
    },
  });

  const handleConnect = (platform: string) => {
    toast.info("Fitur OAuth belum dikonfigurasi. Silakan hubungi administrator untuk setup API credentials.");
  };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-700 dark:text-amber-400">Setup API Required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Untuk mengaktifkan fitur posting otomatis, Anda perlu mengonfigurasi:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Meta (Facebook/Instagram): App ID, App Secret dari developers.facebook.com</li>
                <li>TikTok: Client Key, Client Secret dari developers.tiktok.com</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(platformConfig).map(([key, config]) => {
          const connectedAccount = accounts?.find(a => a.platform === key);
          const Icon = config.icon;

          return (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg text-white ${config.color}`}>
                    {Icon ? <Icon className="h-6 w-6" /> : <span className="text-lg font-bold">T</span>}
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
                      {connectedAccount.token_expires_at && (
                        <p className="text-muted-foreground text-xs">
                          Token expires: {new Date(connectedAccount.token_expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => disconnectAccount.mutate(connectedAccount.id)}
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Putuskan
                    </Button>
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
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Hubungkan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connected Accounts Table */}
      {accounts && accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Semua Akun Terhubung</CardTitle>
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
                      {Icon ? <Icon className="h-5 w-5" /> : <span className="font-bold">T</span>}
                      <div>
                        <p className="font-medium">{account.account_name || config?.name}</p>
                        <p className="text-xs text-muted-foreground">{account.platform}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.is_connected ? (
                        <Badge className="bg-green-500/10 text-green-600">Connected</Badge>
                      ) : (
                        <Badge variant="outline">Disconnected</Badge>
                      )}
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
