import { useState } from "react";
import { Bell, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { dismissPushPrompt } from "@/hooks/usePushNotifications";

interface PushPermissionPromptProps {
  onEnable: () => Promise<string>;
}

export function PushPermissionPrompt({ onEnable }: PushPermissionPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  if (dismissed) return null;

  const handleDismiss = () => {
    dismissPushPrompt();
    setDismissed(true);
  };

  const handleEnable = async () => {
    setLoading(true);
    await onEnable();
    setLoading(false);
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t("Enable Notifications", "Aktifkan Notifikasi")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                "Get real-time updates about tasks, deadlines, and team activity.",
                "Dapatkan update real-time tentang tugas, deadline, dan aktivitas tim."
              )}
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleEnable} disabled={loading} className="gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                {loading
                  ? t("Enabling...", "Mengaktifkan...")
                  : t("Enable", "Aktifkan")}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                {t("Not now", "Nanti saja")}
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function IOSInstallPrompt() {
  const [dismissed, setDismissed] = useState(false);
  const { t } = useLanguage();

  // Only show on iOS Safari that is NOT standalone (not installed)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone === true;
  const dismissedKey = "ios_install_dismissed";

  if (!isIOS || isStandalone || dismissed) return null;

  // Check if dismissed recently
  const lastDismissed = localStorage.getItem(dismissedKey);
  if (lastDismissed && Date.now() - parseInt(lastDismissed, 10) < 7 * 24 * 60 * 60 * 1000) return null;

  const handleDismiss = () => {
    localStorage.setItem(dismissedKey, Date.now().toString());
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t("Install Talco App", "Install Talco App")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                "Install Talco on your home screen to receive push notifications. Tap the Share button, then 'Add to Home Screen'.",
                "Install Talco di home screen untuk menerima push notification. Tap tombol Share, lalu 'Add to Home Screen'."
              )}
            </p>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="mt-2">
              {t("Got it", "Mengerti")}
            </Button>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
