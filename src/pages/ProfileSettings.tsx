import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { Eye, EyeOff, Globe, Lock, User, Bell, BellOff, BellRing, Smartphone } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useQuery } from "@tanstack/react-query";

function LanguageCard() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600/15 to-cyan-600/15 flex items-center justify-center">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base">{t("Language", "Bahasa")}</CardTitle>
            <CardDescription>{t("Choose your preferred system language", "Pilih bahasa sistem yang diinginkan")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <Button
            variant={language === "en" ? "default" : "outline"}
            onClick={() => setLanguage("en")}
            className="flex-1 gap-2"
          >
            🇬🇧 English
          </Button>
          <Button
            variant={language === "id" ? "default" : "outline"}
            onClick={() => setLanguage("id")}
            className="flex-1 gap-2"
          >
            🇮🇩 Bahasa Indonesia
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangePasswordCard() {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("Password must be at least 6 characters", "Password minimal 6 karakter"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("Passwords do not match", "Password tidak cocok"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("Password updated successfully", "Password berhasil diubah"));
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || t("Failed to update password", "Gagal mengubah password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-600/15 to-red-600/15 flex items-center justify-center">
            <Lock className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-base">{t("Change Password", "Ubah Password")}</CardTitle>
            <CardDescription>{t("Update your account password", "Perbarui password akun Anda")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("New Password", "Password Baru")}</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("Confirm Password", "Konfirmasi Password")}</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleChangePassword} disabled={loading || !newPassword || !confirmPassword} className="gap-2">
            <Lock className="h-4 w-4" />
            {loading ? t("Updating...", "Mengubah...") : t("Update Password", "Ubah Password")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettingsCard() {
  const { t } = useLanguage();
  const [permissionState, setPermissionState] = useState<string>("default");
  const [loading, setLoading] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-profile-notif"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      return session.session.user;
    },
  });

  const { enableNotifications, testNotification } = usePushNotifications(currentUser?.id);

  // Check subscription count
  const { data: subscriptions, refetch: refetchSubs } = useQuery({
    queryKey: ["my-push-subs", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id, device_type, device_name, created_at, is_active")
        .eq("user_id", currentUser.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentUser?.id,
  });

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionState(Notification.permission);
    } else {
      setPermissionState("unsupported");
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await enableNotifications();
      setPermissionState(result);
      if (result === "granted") {
        toast.success(t("Notifications enabled!", "Notifikasi diaktifkan!"));
        refetchSubs();
      } else if (result === "denied") {
        toast.error(t(
          "Permission denied. Please enable notifications in your browser settings.",
          "Izin ditolak. Silakan aktifkan notifikasi di pengaturan browser Anda."
        ));
      }
    } catch {
      toast.error(t("Failed to enable notifications", "Gagal mengaktifkan notifikasi"));
    } finally {
      setLoading(false);
    }
  };

  const handleTest = () => {
    testNotification();
    toast.success(t("Test notification sent!", "Test notifikasi terkirim!"));
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-600/15 to-orange-600/15 flex items-center justify-center">
            <Bell className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base">{t("Push Notifications", "Push Notifikasi")}</CardTitle>
            <CardDescription>
              {t(
                "Receive real-time notifications about tasks, deadlines, and team activity",
                "Terima notifikasi real-time tentang tugas, deadline, dan aktivitas tim"
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          {permissionState === "granted" ? (
            <>
              <BellRing className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {t("Notifications are enabled", "Notifikasi aktif")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscriptions?.length || 0} {t("device(s) registered", "perangkat terdaftar")}
                </p>
              </div>
            </>
          ) : permissionState === "denied" ? (
            <>
              <BellOff className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {t("Notifications are blocked", "Notifikasi diblokir")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Please enable notifications in your browser/device settings, then refresh this page.",
                    "Silakan aktifkan notifikasi di pengaturan browser/perangkat, lalu refresh halaman ini."
                  )}
                </p>
              </div>
            </>
          ) : permissionState === "unsupported" ? (
            <>
              <BellOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("Not supported on this browser", "Tidak didukung di browser ini")}
                </p>
              </div>
            </>
          ) : (
            <>
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("Notifications not yet enabled", "Notifikasi belum diaktifkan")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Click the button below to enable push notifications on this device.",
                    "Klik tombol di bawah untuk mengaktifkan push notifikasi di perangkat ini."
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* iOS PWA hint */}
        {isIOS && !isStandalone && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <Smartphone className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {t(
                "On iPhone/iPad, push notifications only work when the app is installed to your Home Screen. Tap the Share button in Safari, then 'Add to Home Screen'.",
                "Di iPhone/iPad, push notifikasi hanya berfungsi jika app di-install ke Home Screen. Tap tombol Share di Safari, lalu 'Add to Home Screen'."
              )}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {permissionState !== "granted" && permissionState !== "unsupported" && (
            <Button onClick={handleEnable} disabled={loading || permissionState === "denied"} className="gap-2">
              <Bell className="h-4 w-4" />
              {loading
                ? t("Enabling...", "Mengaktifkan...")
                : t("Enable Notifications", "Aktifkan Notifikasi")}
            </Button>
          )}
          {permissionState === "granted" && (
            <Button variant="outline" onClick={handleTest} className="gap-2">
              <BellRing className="h-4 w-4" />
              {t("Send Test Notification", "Kirim Test Notifikasi")}
            </Button>
          )}
        </div>

        {/* Registered devices */}
        {subscriptions && subscriptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("Registered Devices", "Perangkat Terdaftar")}
            </p>
            <div className="space-y-1.5">
              {subscriptions.map((sub: any) => (
                <div key={sub.id} className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded bg-muted/30">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>{sub.device_name || sub.device_type}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span>{new Date(sub.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProfileSettings() {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <User className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("Profile Settings", "Pengaturan Profil")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("Manage your personal preferences", "Kelola preferensi pribadi Anda")}</p>
          </div>
        </div>

        <LanguageCard />
        <NotificationSettingsCard />
        <ChangePasswordCard />
      </div>
    </AppLayout>
  );
}
