import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Instagram, Facebook, AlertCircle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";

export function SocialMediaAccounts() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch Meta connection status
  const { data: settings } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      try {
        const { data } = await supabase.functions.invoke("meta-api", {
          body: { action: "check-connection", user_id: user.id },
        });
        return data;
      } catch {
        return { is_connected: false };
      }
    },
  });

  // Fetch connected accounts
  const { data: accounts, isLoading } = useQuery({
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

  // Refresh accounts from Meta API
  const handleRefresh = async () => {
    if (!settings?.is_connected) {
      toast.error("Meta API belum terhubung. Silakan masukkan token di Settings.");
      return;
    }

    setIsRefreshing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("meta-api", {
        body: { action: "fetch-pages", user_id: user.id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`${data.pages_count || 0} Pages ditemukan dan disinkronkan`);
      queryClient.invalidateQueries({ queryKey: ["meta-connected-accounts"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal mengambil akun");
    } finally {
      setIsRefreshing(false);
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
                <h3 className="font-medium text-amber-700 dark:text-amber-400">Meta API Belum Terhubung</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Untuk menghubungkan Facebook Pages & Instagram, masukkan Meta Access Token di halaman Settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-emerald-700 dark:text-emerald-400">Meta API Connected</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Facebook Pages & Instagram accounts terhubung via Meta Graph API.
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

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts?.map((account) => (
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
                  <div
                    className={`p-3 rounded-lg text-white ${
                      account.platform === "instagram"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500"
                        : "bg-blue-600"
                    }`}
                  >
                    {account.platform === "instagram" ? (
                      <Instagram className="h-6 w-6" />
                    ) : (
                      <Facebook className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{account.account_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.platform === "instagram"
                        ? "Instagram Business"
                        : "Facebook Page"}
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              </div>
              {account.profile_image_url && (
                <img
                  src={account.profile_image_url}
                  alt={account.account_name || ""}
                  className="w-8 h-8 rounded-full mt-3"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {(!accounts || accounts.length === 0) && isConnected && (
        <Card>
          <CardContent className="py-12 text-center">
            <Facebook className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">Belum ada akun terhubung</p>
            <p className="text-xs text-muted-foreground mt-1">
              Klik "Refresh" untuk mengambil Facebook Pages & Instagram dari Meta API
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
