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
  role_filter?: string[];
  connection_test?: boolean;
}

async function getFonnteApiKey(supabase: any): Promise<string | null> {
  // First try from company_settings (user-provided key)
  const { data } = await supabase
    .from("company_settings")
    .select("setting_value")
    .eq("setting_key", "fonnte_api_key")
    .single();

  if (data?.setting_value) {
    console.log("[WA] Using API key from company_settings");
    return data.setting_value;
  }

  // Fallback to environment variable
  const envKey = Deno.env.get("FONNTE_API_KEY");
  if (envKey) {
    console.log("[WA] Using API key from environment variable");
    return envKey;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendWhatsAppRequest = await req.json();
    const { user_ids, phone, message, event_type, role_filter, connection_test } = body;

    // Get API key from DB or env
    const FONNTE_API_KEY = await getFonnteApiKey(supabase);
    if (!FONNTE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Fonnte API Key belum dikonfigurasi. Masukkan API Key di Settings.", connection_valid: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connection test mode — validate API key by calling Fonnte device info
    if (connection_test) {
      try {
        const testResp = await fetch("https://api.fonnte.com/device", {
          method: "POST",
          headers: { Authorization: FONNTE_API_KEY },
        });
        const testData = await testResp.json();
        console.log("[WA] Connection test result:", JSON.stringify(testData));

        const isValid = testData.status === true;
        return new Response(
          JSON.stringify({
            connection_valid: isValid,
            message: isValid ? "API Key valid dan device terhubung" : (testData.reason || testData.detail || "API Key tidak valid atau device belum terhubung"),
            device_info: isValid ? { name: testData.name, device: testData.device, quota: testData.quota } : null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ connection_valid: false, message: "Gagal menghubungi Fonnte API: " + err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!message || !event_type) {
      return new Response(
        JSON.stringify({ error: "message and event_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this event type is enabled in settings
    const { data: settingRow } = await supabase
      .from("wa_notification_settings")
      .select("is_enabled, send_to_personal, send_to_all_users, group_ids, role_filter")
      .eq("event_type", event_type)
      .single();

    if (settingRow && !settingRow.is_enabled) {
      console.log(`[WA] Event type "${event_type}" is disabled, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Event type disabled", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sendToPersonal = settingRow?.send_to_personal ?? true;
    const sendToAllUsers = settingRow?.send_to_all_users ?? false;
    const groupIds: string[] = settingRow?.group_ids || [];
    const settingsRoleFilter: string[] = settingRow?.role_filter || [];

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

    // Determine target user IDs for personal messages
    let targetUserIds = user_ids || [];

    const effectiveRoleFilter = [...new Set([...(role_filter || []), ...settingsRoleFilter])];

    if (effectiveRoleFilter.length > 0 && !sendToAllUsers) {
      console.log(`[WA] Role filter active: ${effectiveRoleFilter.join(", ")}`);
      const { data: roleUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", effectiveRoleFilter);

      const { data: dynRoles } = await supabase
        .from("dynamic_roles")
        .select("id, name")
        .or(effectiveRoleFilter.map(r => `name.ilike.%${r}%`).join(","));

      let dynUserIds: string[] = [];
      if (dynRoles && dynRoles.length > 0) {
        const dynRoleIds = dynRoles.map(r => r.id);
        const { data: dynRoleUsers } = await supabase
          .from("user_dynamic_roles")
          .select("user_id")
          .in("role_id", dynRoleIds);
        dynUserIds = (dynRoleUsers || []).map(u => u.user_id);
      }

      const roleUserIds = new Set([
        ...(roleUsers || []).map(u => u.user_id),
        ...dynUserIds,
      ]);

      if (targetUserIds.length > 0) {
        targetUserIds = targetUserIds.filter(id => roleUserIds.has(id));
        for (const uid of roleUserIds) {
          if (!targetUserIds.includes(uid)) targetUserIds.push(uid);
        }
      } else {
        targetUserIds = Array.from(roleUserIds);
      }
      console.log(`[WA] After role filter: ${targetUserIds.length} users`);
    }

    if (sendToAllUsers) {
      console.log(`[WA] send_to_all_users enabled for "${event_type}"`);
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id")
        .or("status.is.null,status.eq.active");
      
      if (allProfiles) {
        const allIds = allProfiles.map(p => p.id);
        targetUserIds = Array.from(new Set([...targetUserIds, ...allIds]));
      }
      console.log(`[WA] After all_users merge: ${targetUserIds.length} users`);
    }

    if (sendToPersonal && targetUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", targetUserIds);

      if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
          const phoneNumber = profile.phone;
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

    if (groupIds.length > 0 && event_type !== "attendance_reminder") {
      console.log(`[WA] Sending to ${groupIds.length} groups for event: ${event_type}`);
      for (const groupId of groupIds) {
        const groupMessage = `📢 *Notifikasi Sistem*\n\n${message}`;
        const result = await sendToFonnte(FONNTE_API_KEY, groupId, groupMessage);

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
