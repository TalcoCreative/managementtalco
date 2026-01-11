import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function SocialMediaSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["social-media-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (secret: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      if (settings?.id) {
        // Update existing
        const { error } = await supabase
          .from("social_media_settings")
          .update({
            api_secret_encrypted: secret,
            is_connected: true,
            updated_at: new Date().toISOString(),
            updated_by: user.user?.id,
          })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("social_media_settings")
          .insert({
            api_secret_encrypted: secret,
            is_connected: true,
            updated_by: user.user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("SocialBu berhasil terkoneksi");
      setApiSecret("");
      queryClient.invalidateQueries({ queryKey: ["social-media-settings"] });
    },
    onError: (error) => {
      toast.error("Gagal mengkoneksikan: " + error.message);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      
      const { error } = await supabase
        .from("social_media_settings")
        .update({
          api_secret_encrypted: null,
          is_connected: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SocialBu berhasil di-disconnect");
      queryClient.invalidateQueries({ queryKey: ["social-media-settings"] });
    },
    onError: (error) => {
      toast.error("Gagal disconnect: " + error.message);
    },
  });

  // Manual sync
  const handleSync = async () => {
    if (!settings?.is_connected) {
      toast.error("SocialBu belum terkoneksi");
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-socialbu", {
        body: { action: "sync" },
      });

      if (error) throw error;

      // Update last sync time
      await supabase
        .from("social_media_settings")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", settings.id);

      toast.success(`Sync berhasil! ${data?.synced || 0} posts diupdate.`);
      queryClient.invalidateQueries({ queryKey: ["social-media-settings"] });
      queryClient.invalidateQueries({ queryKey: ["social-media-posts"] });
    } catch (error: any) {
      toast.error("Sync gagal: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnect = () => {
    if (!apiSecret.trim()) {
      toast.error("Masukkan API Secret Code");
      return;
    }
    connectMutation.mutate(apiSecret);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/social-media")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Social Media Settings</h1>
              <p className="text-muted-foreground">
                Konfigurasi integrasi SocialBu
              </p>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              SocialBu Integration
            </CardTitle>
            <CardDescription>
              Hubungkan akun SocialBu untuk sync posts otomatis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status */}
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
                  <Badge variant={settings?.is_connected ? "default" : "secondary"}>
                    {settings?.is_connected ? "Connected" : "Not Connected"}
                  </Badge>
                </div>
              </div>
              {settings?.is_connected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              )}
            </div>

            {/* Last Sync */}
            {settings?.is_connected && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Last Sync</p>
                    <p className="text-sm text-muted-foreground">
                      {settings.last_sync_at
                        ? format(new Date(settings.last_sync_at), "dd MMM yyyy HH:mm")
                        : "Belum pernah sync"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
              </div>
            )}

            <Separator />

            {/* Connect Form */}
            {!settings?.is_connected && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-secret">SocialBu API Secret Code</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="api-secret"
                        type={showSecret ? "text" : "password"}
                        placeholder="Masukkan API Secret Code"
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      onClick={handleConnect}
                      disabled={connectMutation.isPending || !apiSecret.trim()}
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Connect
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dapatkan API Secret Code dari SocialBu Dashboard → Settings → API
                  </p>
                </div>
              </div>
            )}

            {/* Update Secret Form (when connected) */}
            {settings?.is_connected && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="update-secret">Update API Secret Code</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="update-secret"
                        type={showSecret ? "text" : "password"}
                        placeholder="Masukkan API Secret baru"
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleConnect}
                      disabled={connectMutation.isPending || !apiSecret.trim()}
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Update
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle>Cara Kerja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. Connect SocialBu</h4>
              <p className="text-sm text-muted-foreground">
                Masukkan API Secret Code dari akun SocialBu untuk mengaktifkan integrasi.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">2. Sync Posts</h4>
              <p className="text-sm text-muted-foreground">
                Posts dari SocialBu akan otomatis di-sync dan ditampilkan di dashboard.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">3. Assign Client</h4>
              <p className="text-sm text-muted-foreground">
                Setiap post dapat di-assign ke client untuk tracking dan reporting.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
