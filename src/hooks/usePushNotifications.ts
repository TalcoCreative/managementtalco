import { useEffect, useCallback, useRef, useState } from "react";
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

// Check if user dismissed the prompt recently (within 3 days)
function isPromptDismissed(): boolean {
  const dismissed = localStorage.getItem("push_prompt_dismissed");
  if (!dismissed) return false;
  const dismissedAt = parseInt(dismissed, 10);
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt < threeDays;
}

export function dismissPushPrompt() {
  localStorage.setItem("push_prompt_dismissed", Date.now().toString());
}

export function usePushNotifications(userId?: string | null) {
  const permissionGranted = useRef(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const subscribedRef = useRef(false);

  // Fetch VAPID public key
  useEffect(() => {
    const fetchVapidKey = async () => {
      try {
        const { data } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("setting_key", "vapid_public_key")
          .single();

        if (data?.setting_value) {
          setVapidPublicKey(data.setting_value);
          return;
        }

        const { data: result, error } = await supabase.functions.invoke("get-vapid-key");
        if (!error && result?.publicKey) {
          setVapidPublicKey(result.publicKey);
        }
      } catch (err) {
        console.error("[Push] Failed to fetch VAPID key:", err);
      }
    };
    fetchVapidKey();
  }, []);

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

  const subscribeAndSave = useCallback(async (uid: string) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) return;
    if (subscribedRef.current) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const appServerKeyArray = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKeyArray.buffer as ArrayBuffer,
        });
        console.log("[Push] Created new push subscription");
      }

      const key = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!key || !auth) return;

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const { error: upsertError } = await supabase.from("push_subscriptions").upsert({
        user_id: uid,
        endpoint: subscription.endpoint,
        p256dh_key: p256dh,
        auth_key: authKey,
        device_type: getDeviceType(),
        device_name: getDeviceName(),
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,endpoint" });

      if (upsertError) {
        console.error("[Push] Failed to save subscription:", upsertError);
        return;
      }

      subscribedRef.current = true;
      console.log("[Push] Subscription saved for user:", uid);
    } catch (err) {
      console.error("[Push] Failed to subscribe:", err);
    }
  }, [vapidPublicKey]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
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
        }).catch(() => new Notification(title, { icon: "/pwa-512.png", ...options }));
      } else {
        new Notification(title, { icon: "/pwa-512.png", ...options });
      }
    } catch (err) {
      console.error("[Push] Error:", err);
    }
  }, []);

  // Main initialization
  useEffect(() => {
    if (!userId) return;

    const init = async () => {
      // Check if Notification API is available
      const hasNotificationAPI = "Notification" in window;

      if (!hasNotificationAPI) {
        // Device doesn't support notifications at all (rare)
        return;
      }

      if (Notification.permission === "granted") {
        permissionGranted.current = true;
        await subscribeAndSave(userId);
      } else if (Notification.permission === "default") {
        // Always show prompt if not dismissed recently
        if (!isPromptDismissed()) {
          setShouldShowPrompt(true);
        }
      }
      // If "denied", don't show prompt
    };
    init();
  }, [userId, vapidPublicKey, subscribeAndSave]);

  const enableNotifications = useCallback(async () => {
    const result = await requestPermission();
    setShouldShowPrompt(false);
    if (result === "granted" && userId) {
      await subscribeAndSave(userId);
    } else if (result === "denied") {
      dismissPushPrompt();
    }
    return result;
  }, [requestPermission, userId, subscribeAndSave]);

  const testNotification = useCallback(() => {
    showNotification("Talco - Test 🔔", { body: "Push notifications are working!", tag: "test" });
  }, [showNotification]);

  return {
    showNotification,
    requestPermission,
    testNotification,
    enableNotifications,
    shouldShowPrompt,
  };
}
