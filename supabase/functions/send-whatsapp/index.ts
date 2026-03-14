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

    const results: any[] = [];

    // If direct phone number provided (test mode)
    if (phone) {
      const result = await sendToFonnte(FONNTE_API_KEY, phone, message);
      // Log it
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

    // If user_ids provided, look up phone numbers from profiles
    if (user_ids && user_ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", user_ids);

      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No profiles found", results: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const profile of profiles) {
        const phoneNumber = profile.phone;

        // Validate phone number
        if (!phoneNumber || !isValidPhone(phoneNumber)) {
          await supabase.from("notification_logs").insert({
            user_id: profile.id,
            phone_number: phoneNumber || null,
            message,
            event_type,
            status: "invalid_number",
            response_api: JSON.stringify({ error: "Phone number empty or invalid" }),
          });
          results.push({ user_id: profile.id, status: "invalid_number" });
          continue;
        }

        const result = await sendToFonnte(FONNTE_API_KEY, phoneNumber, message);

        await supabase.from("notification_logs").insert({
          user_id: profile.id,
          phone_number: phoneNumber,
          message,
          event_type,
          status: result.success ? "success" : "failed",
          response_api: JSON.stringify(result.response),
        });

        results.push({ user_id: profile.id, phone: phoneNumber, ...result });
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
  // Accept 08xxxxxxxxxx format (Indonesian)
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^08\d{8,13}$/.test(cleaned);
}

async function sendToFonnte(apiKey: string, target: string, message: string) {
  try {
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target,
        message,
        typing: true,
        delay: "1",
      }),
    });

    const data = await response.json();
    return {
      success: response.ok && data.status === true,
      response: data,
    };
  } catch (err) {
    return {
      success: false,
      response: { error: err.message },
    };
  }
}
