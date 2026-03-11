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

    // Check if VAPID keys already exist
    const { data: existingPublic } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("setting_key", "vapid_public_key")
      .single();

    if (existingPublic?.setting_value) {
      return new Response(
        JSON.stringify({ publicKey: existingPublic.setting_value }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new VAPID keys using web-push library (guaranteed compatible)
    const vapidKeys = webpush.generateVAPIDKeys();

    // Store both keys
    await supabase.from("company_settings").upsert([
      { setting_key: "vapid_public_key", setting_value: vapidKeys.publicKey, updated_at: new Date().toISOString() },
      { setting_key: "vapid_private_key", setting_value: vapidKeys.privateKey, updated_at: new Date().toISOString() },
    ], { onConflict: "setting_key" });

    console.log("[VAPID] Generated and stored new VAPID keys using web-push library");

    return new Response(
      JSON.stringify({ publicKey: vapidKeys.publicKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[VAPID] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
