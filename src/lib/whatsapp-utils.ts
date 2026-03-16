import { supabase } from "@/integrations/supabase/client";

/**
 * Send WhatsApp notification to specific users via Fonnte API (edge function).
 * @param roleFilter — if provided, only users with these roles get personal messages (e.g. ["hr","super_admin"])
 */
export async function sendWhatsApp(params: {
  userIds: string[];
  message: string;
  eventType: string;
  roleFilter?: string[];
}) {
  // Allow sending even with empty userIds if groups might be configured
  try {
    console.log(`[WhatsApp] Sending event: ${params.eventType}, users: ${params.userIds.length}, roleFilter: ${params.roleFilter?.join(",") || "none"}`);
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        user_ids: params.userIds,
        message: params.message,
        event_type: params.eventType,
        role_filter: params.roleFilter,
      },
    });
    if (error) {
      console.error("[WhatsApp] Edge function error:", error);
    } else {
      console.log("[WhatsApp] Response:", data);
    }
  } catch (err) {
    console.error("[WhatsApp] Failed to send:", err);
  }
}

/**
 * Send a test WhatsApp message for a specific event type (to groups only or phone).
 */
export async function sendTestWhatsApp(phone: string, message: string) {
  const { data, error } = await supabase.functions.invoke("send-whatsapp", {
    body: {
      phone,
      message,
      event_type: "test",
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Send a test WhatsApp for a specific event type — triggers group routing.
 */
export async function sendTestEventWhatsApp(eventType: string, message: string) {
  const { data, error } = await supabase.functions.invoke("send-whatsapp", {
    body: {
      message,
      event_type: eventType,
      user_ids: [], // no personal, just groups
    },
  });
  if (error) throw error;
  return data;
}
