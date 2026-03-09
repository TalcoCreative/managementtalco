import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Mac/.test(ua)) return "mac";
  return "other";
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android Device";
  return "Desktop Browser";
}

export function usePushNotifications() {
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      return session.session?.user || null;
    },
  });

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return await Notification.requestPermission();
  }, []);

  const saveSubscription = useCallback(async (userId: string) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // For now, generate a VAPID-less subscription or use applicationServerKey if available
        // We'll use a simple approach - store the endpoint for notification display
        return;
      }

      const key = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");

      if (!key || !auth) return;

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

      // Upsert subscription
      await supabase
        .from("push_subscriptions")
        .upsert({
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh_key: p256dh,
          auth_key: authKey,
          device_type: getDeviceType(),
          device_name: getDeviceName(),
          is_active: true,
        }, { onConflict: "endpoint" });
    } catch (err) {
      console.error("Failed to save push subscription:", err);
    }
  }, []);

  // Show a browser notification
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!("Notification" in window)) {
      console.log("[Push] Notification API not supported");
      return;
    }
    if (Notification.permission !== "granted") {
      console.log("[Push] Permission not granted:", Notification.permission);
      return;
    }

    console.log("[Push] Showing notification:", title);

    try {
      // Try service worker notification first (works better in background/PWA)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            icon: "/pwa-512.png",
            badge: "/pwa-512.png",
            tag: options?.tag || `talco-${Date.now()}`,
            vibrate: [200, 100, 200],
            requireInteraction: false,
            ...options,
          } as any);
          console.log("[Push] SW notification sent");
        }).catch((err) => {
          console.log("[Push] SW failed, using fallback:", err);
          // Fallback to regular Notification
          new Notification(title, {
            icon: "/pwa-512.png",
            ...options,
          });
        });
      } else {
        new Notification(title, {
          icon: "/pwa-512.png",
          ...options,
        });
      }
    } catch (err) {
      console.error("[Push] Error showing notification:", err);
    }
  }, []);

  // Auto-request permission and save subscription when user is logged in
  useEffect(() => {
    if (!currentUser) return;

    const init = async () => {
      const permission = await requestPermission();
      if (permission === "granted") {
        await saveSubscription(currentUser.id);
      }
    };

    init();
  }, [currentUser, requestPermission, saveSubscription]);

  return { showNotification, requestPermission };
}
