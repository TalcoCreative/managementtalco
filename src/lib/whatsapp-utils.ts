import { supabase } from "@/integrations/supabase/client";

/**
 * Send WhatsApp notification to specific users via Fonnte API (edge function).
 */
export async function sendWhatsApp(params: {
  userIds: string[];
  message: string;
  eventType: string;
}) {
  if (params.userIds.length === 0) return;

  try {
    console.log(`[WhatsApp] Sending to ${params.userIds.length} users, event: ${params.eventType}`);
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        user_ids: params.userIds,
        message: params.message,
        event_type: params.eventType,
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
 * Send a test WhatsApp message to a specific phone number.
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
