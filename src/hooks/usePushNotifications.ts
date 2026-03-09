import { useEffect, useCallback, useRef } from "react";
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
  const permissionGranted = useRef(false);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-push"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("[Push] Notification API not supported");
      return "denied";
    }
    if (Notification.permission === "granted") {
      permissionGranted.current = true;
      return "granted";
    }
    if (Notification.permission === "denied") return "denied";
    const result = await Notification.requestPermission();
    permissionGranted.current = result === "granted";
    return result;
  }, []);

  const saveSubscription = useCallback(async (userId: string) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      const key = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!key || !auth) return;

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

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
      console.error("[Push] Failed to save push subscription:", err);
    }
  }, []);

  // Show a browser/SW notification
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!("Notification" in window)) {
      console.log("[Push] Notification API not supported");
      return;
    }
    if (Notification.permission !== "granted") {
      console.log("[Push] Permission not granted, requesting...");
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          doShowNotification(title, options);
        }
      });
      return;
    }
    doShowNotification(title, options);
  }, []);

  const doShowNotification = (title: string, options?: NotificationOptions) => {
    console.log("[Push] Showing notification:", title, options?.body);
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            icon: "/pwa-512.png",
            badge: "/pwa-512.png",
            tag: options?.tag || `talco-${Date.now()}`,
            vibrate: [200, 100, 200],
            requireInteraction: false,
            ...options,
          } as any);
        }).catch(() => {
          new Notification(title, { icon: "/pwa-512.png", ...options });
        });
      } else {
        new Notification(title, { icon: "/pwa-512.png", ...options });
      }
    } catch (err) {
      console.error("[Push] Error showing notification:", err);
    }
  };

  // Auto-request permission and save subscription
  useEffect(() => {
    if (!currentUser?.id) return;

    const init = async () => {
      console.log("[Push] Initializing for user:", currentUser.id);
      const permission = await requestPermission();
      console.log("[Push] Permission result:", permission);
      if (permission === "granted") {
        await saveSubscription(currentUser.id);
      }
    };
    init();
  }, [currentUser?.id, requestPermission, saveSubscription]);

  const testNotification = useCallback(() => {
    console.log("[Push] Testing notification...");
    showNotification("Talco - Test Notification 🔔", {
      body: "Push notifications are working! Tap to open the app.",
      tag: "test-notification",
    });
  }, [showNotification]);

  return { showNotification, requestPermission, testNotification };
}
