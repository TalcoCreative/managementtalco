import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendWhatsAppRequest {
  user_ids?: string[];
  phone?: string;
  message: string;
  event_type: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FONNTE_API_KEY = Deno.env.get("FONNTE_API_KEY");
    if (!FONNTE_API_KEY) {
      throw new Error("FONNTE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendWhatsAppRequest = await req.json();
    const { user_ids, phone, message, event_type } = body;

    if (!message || !event_type) {
      return new Response(
        JSON.stringify({ error: "message and event_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this event type is enabled in settings
    const { data: settingRow } = await supabase
      .from("wa_notification_settings")
      .select("is_enabled, send_to_personal, group_ids")
      .eq("event_type", event_type)
      .single();

    // If setting exists and is disabled, skip entirely
    if (settingRow && !settingRow.is_enabled) {
      console.log(`[WA] Event type "${event_type}" is disabled, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Event type disabled", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sendToPersonal = settingRow?.send_to_personal ?? true;
    const groupIds: string[] = settingRow?.group_ids || [];

    const results: any[] = [];

    // If direct phone number provided (test mode) — always send
    if (phone) {
      const result = await sendToFonnte(FONNTE_API_KEY, phone, message);
      await supabase.from("notification_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        phone_number: phone,
        message,
        event_type,
        status: result.success ? "success" : "failed",
        response_api: JSON.stringify(result.response),
      });
      results.push(result);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send to individual users (personal) if enabled
    if (sendToPersonal && user_ids && user_ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", user_ids);

      if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
          const phoneNumber = profile.phone;

          // Personalize message with "Halo [nama]"
          const personalizedMessage = `Halo ${profile.full_name || "Team"}! 👋\n\n${message}`;

          if (!phoneNumber || !isValidPhone(phoneNumber)) {
            await supabase.from("notification_logs").insert({
              user_id: profile.id,
              phone_number: phoneNumber || null,
              message: personalizedMessage,
              event_type,
              status: "invalid_number",
              response_api: JSON.stringify({ error: "Phone number empty or invalid" }),
            });
            results.push({ user_id: profile.id, status: "invalid_number" });
            continue;
          }

          const result = await sendToFonnte(FONNTE_API_KEY, phoneNumber, personalizedMessage);

          await supabase.from("notification_logs").insert({
            user_id: profile.id,
            phone_number: phoneNumber,
            message: personalizedMessage,
            event_type,
            status: result.success ? "success" : "failed",
            response_api: JSON.stringify(result.response),
          });

          results.push({ user_id: profile.id, phone: phoneNumber, ...result });
        }
      }
    }

    // Send to assigned groups
    if (groupIds.length > 0) {
      console.log(`[WA] Sending to ${groupIds.length} groups for event: ${event_type}`);
      for (const groupId of groupIds) {
        const groupMessage = `📢 *Notifikasi Sistem*\n\n${message}`;
        const result = await sendToFonnte(FONNTE_API_KEY, groupId, groupMessage);

        // Get group name for logging
        const { data: groupData } = await supabase
          .from("wa_groups")
          .select("name")
          .eq("id", groupId)
          .single();

        await supabase.from("notification_logs").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          phone_number: groupId,
          message: groupMessage,
          event_type,
          status: result.success ? "success" : "failed",
          response_api: JSON.stringify({ ...result.response, group_name: groupData?.name }),
        });

        results.push({ group_id: groupId, group_name: groupData?.name, ...result });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^08\d{8,13}$/.test(cleaned);
}

async function sendToFonnte(apiKey: string, target: string, message: string) {
  try {
    console.log(`[Fonnte] Sending to ${target}, message length: ${message.length}`);

    const formData = new URLSearchParams();
    formData.append("target", target);
    formData.append("message", message);
    formData.append("typing", "true");
    formData.append("delay", "1");
    formData.append("countryCode", "62");

    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: apiKey,
      },
      body: formData,
    });

    const data = await response.json();
    console.log(`[Fonnte] Response for ${target}:`, JSON.stringify(data));

    return {
      success: data.status === true,
      response: data,
    };
  } catch (err) {
    console.error(`[Fonnte] Error for ${target}:`, err.message);
    return {
      success: false,
      response: { error: err.message },
    };
  }
}
