import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate VAPID keys using Web Crypto API
async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const publicKeyBuffer = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  // Convert to URL-safe base64
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  // Extract raw 32-byte private key from PKCS8 (last 32 bytes)
  const privBytes = new Uint8Array(privateKeyBuffer);
  const rawPriv = privBytes.slice(privBytes.length - 32);
  const privateKey = btoa(String.fromCharCode(...rawPriv))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return { publicKey, privateKey };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if VAPID keys already exist in company_settings
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

    // Generate new VAPID keys
    const { publicKey, privateKey } = await generateVapidKeys();

    // Store both keys
    await supabase.from("company_settings").upsert([
      { setting_key: "vapid_public_key", setting_value: publicKey, updated_at: new Date().toISOString() },
      { setting_key: "vapid_private_key", setting_value: privateKey, updated_at: new Date().toISOString() },
    ], { onConflict: "setting_key" });

    console.log("[VAPID] Generated and stored new VAPID keys");

    return new Response(
      JSON.stringify({ publicKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[VAPID] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
