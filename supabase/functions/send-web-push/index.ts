import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, user_ids, title, body, url, tag, data: extraData, triggered_by } = await req.json();

    const targetUserIds: string[] = user_ids || (user_id ? [user_id] : []);
    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "user_id or user_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get VAPID keys from company_settings
    const { data: vapidSettings } = await supabase
      .from("company_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["vapid_public_key", "vapid_private_key"]);

    const vapidPublicKey = vapidSettings?.find((s: any) => s.setting_key === "vapid_public_key")?.setting_value;
    const vapidPrivateKey = vapidSettings?.find((s: any) => s.setting_key === "vapid_private_key")?.setting_value;

    if (!vapidPublicKey || !vapidPrivateKey) {
      // Log failure
      await supabase.from("push_notification_logs").insert({
        user_ids: targetUserIds,
        title: title || "N/A",
        body: body || "",
        url: url || "/",
        tag: tag || "",
        status: "failed",
        error_details: "VAPID keys not configured",
        triggered_by: triggered_by || "system",
      });

      return new Response(
        JSON.stringify({ error: "VAPID keys not configured. Call get-vapid-key first." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    webpush.setVapidDetails("mailto:admin@talco.id", vapidPublicKey, vapidPrivateKey);

    // Get all active subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds)
      .eq("is_active", true);

    if (subError) {
      await supabase.from("push_notification_logs").insert({
        user_ids: targetUserIds,
        title: title || "N/A",
        body: body || "",
        url: url || "/",
        tag: tag || "",
        status: "failed",
        error_details: `Subscription query error: ${subError.message}`,
        triggered_by: triggered_by || "system",
      });

      return new Response(
        JSON.stringify({ error: subError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      await supabase.from("push_notification_logs").insert({
        user_ids: targetUserIds,
        title: title || "N/A",
        body: body || "",
        url: url || "/",
        tag: tag || "",
        status: "no_subscribers",
        sent_count: 0,
        total_subscriptions: 0,
        triggered_by: triggered_by || "system",
      });

      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[WebPush] Sending to ${subscriptions.length} subscription(s)`);

    const pushPayload = JSON.stringify({
      title: title || "Talco Management System",
      body: body || "You have a new notification",
      icon: "/pwa-512.png",
      badge: "/pwa-512.png",
      tag: tag || `talco-${Date.now()}`,
      data: { url: url || "/", ...extraData },
    });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];
    const errorMessages: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayload, {
            TTL: 86400,
            urgency: "high",
          });
          sent++;
          console.log(`[WebPush] ✓ Sent to ${sub.device_name || sub.device_type}`);
        } catch (err: any) {
          const errMsg = `${sub.device_name}: ${err.statusCode} ${err.body || err.message}`;
          console.error(`[WebPush] ✗ ${errMsg}`);
          errorMessages.push(errMsg);
          if (err.statusCode === 410 || err.statusCode === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
          failed++;
        }
      })
    );

    // Deactivate expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false })
        .in("endpoint", expiredEndpoints);
    }

    // Log the push notification activity
    await supabase.from("push_notification_logs").insert({
      user_ids: targetUserIds,
      title: title || "N/A",
      body: body || "",
      url: url || "/",
      tag: tag || "",
      status: sent > 0 ? "sent" : "failed",
      sent_count: sent,
      failed_count: failed,
      total_subscriptions: subscriptions.length,
      error_details: errorMessages.length > 0 ? errorMessages.join("; ") : null,
      triggered_by: triggered_by || "system",
    });

    console.log(`[WebPush] Done: sent=${sent}, failed=${failed}, total=${subscriptions.length}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[WebPush] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
