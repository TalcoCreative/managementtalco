import { supabase } from "@/integrations/supabase/client";

/**
 * Send a real Web Push notification to one or more users via the server.
 * This sends a push even if the user's browser is closed.
 */
export async function sendWebPush(params: {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  if (params.userIds.length === 0) return;

  try {
    console.log(`[WebPush] Invoking send-web-push for ${params.userIds.length} users, tag: ${params.tag}`);
    const { data, error } = await supabase.functions.invoke("send-web-push", {
      body: {
        user_ids: params.userIds,
        title: params.title,
        body: params.body,
        url: params.url || "/",
        tag: params.tag || `talco-${Date.now()}`,
      },
    });
    if (error) {
      console.error("[WebPush] Edge function error:", error);
    } else {
      console.log("[WebPush] Response:", data);
    }
  } catch (err) {
    console.error("[WebPush] Failed to send:", err);
  }
}
