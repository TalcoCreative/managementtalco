import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function usePushNotifications(userId?: string | null) {
  const permissionGranted = useRef(false);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied";
    if (Notification.permission === "granted") {
      permissionGranted.current = true;
      return "granted";
    }
    if (Notification.permission === "denied") return "denied";
    const result = await Notification.requestPermission();
    permissionGranted.current = result === "granted";
    return result;
  }, []);

  const saveSubscription = useCallback(async (uid: string) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      const key = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!key || !auth) return;
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));
      await supabase.from("push_subscriptions").upsert({
        user_id: uid, endpoint: subscription.endpoint,
        p256dh_key: p256dh, auth_key: authKey,
        device_type: getDeviceType(), device_name: getDeviceName(), is_active: true,
      }, { onConflict: "endpoint" });
    } catch (err) {
      console.error("[Push] Failed to save subscription:", err);
    }
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            icon: "/pwa-512.png", badge: "/pwa-512.png",
            tag: options?.tag || `talco-${Date.now()}`,
            vibrate: [200, 100, 200], requireInteraction: false, ...options,
          } as any);
        }).catch(() => new Notification(title, { icon: "/pwa-512.png", ...options }));
      } else {
        new Notification(title, { icon: "/pwa-512.png", ...options });
      }
    } catch (err) {
      console.error("[Push] Error:", err);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const init = async () => {
      const permission = await requestPermission();
      if (permission === "granted") await saveSubscription(userId);
    };
    init();
  }, [userId, requestPermission, saveSubscription]);

  const testNotification = useCallback(() => {
    showNotification("Talco - Test 🔔", { body: "Push notifications are working!", tag: "test" });
  }, [showNotification]);

  return { showNotification, requestPermission, testNotification };
}
