import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    // Get Meta credentials from social_media_settings
    const getMetaCredentials = async (userId: string) => {
      const { data } = await supabase
        .from("social_media_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    };

    // ─── Save Meta API Credentials ─────────────────────
    if (action === "save-credentials") {
      const { user_id, meta_app_id, meta_app_secret, meta_access_token } = params;
      if (!user_id) throw new Error("User ID required");

      // Validate token by calling Meta API
      let isValid = false;
      let tokenInfo: any = null;
      
      if (meta_access_token) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${meta_access_token}`
          );
          tokenInfo = await res.json();
          isValid = !tokenInfo.error;
        } catch {
          isValid = false;
        }
      }

      // Upsert settings
      const { data: existing } = await supabase
        .from("social_media_settings")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      const settingsData = {
        user_id,
        auth_token: meta_access_token || null,
        api_secret_encrypted: meta_app_secret || null,
        is_connected: isValid,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from("social_media_settings")
          .update(settingsData)
          .eq("id", existing.id);
      } else {
        await supabase.from("social_media_settings").insert(settingsData);
      }

      return new Response(
        JSON.stringify({
          success: true,
          is_connected: isValid,
          token_info: tokenInfo,
          message: isValid
            ? `Connected as ${tokenInfo?.name || "Meta User"}`
            : "Token saved but could not verify. Check your access token.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check Connection ──────────────────────────────
    if (action === "check-connection") {
      const { user_id } = params;
      const creds = await getMetaCredentials(user_id);

      if (!creds?.auth_token) {
        return new Response(
          JSON.stringify({ is_connected: false, has_token: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify token is still valid
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${creds.auth_token}`
        );
        const data = await res.json();
        const isValid = !data.error;

        if (!isValid && creds.is_connected) {
          await supabase
            .from("social_media_settings")
            .update({ is_connected: false })
            .eq("id", creds.id);
        }

        return new Response(
          JSON.stringify({
            is_connected: isValid,
            has_token: true,
            user_name: data.name,
            user_id: data.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(
          JSON.stringify({ is_connected: false, has_token: true, error: "Network error" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── Fetch Facebook Pages ──────────────────────────
    if (action === "fetch-pages") {
      const { user_id } = params;
      const creds = await getMetaCredentials(user_id);
      if (!creds?.auth_token) throw new Error("Meta access token not configured");

      const res = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}&access_token=${creds.auth_token}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const pages = data.data || [];

      // Sync pages to socialbu_accounts table (reuse for now)
      for (const page of pages) {
        // Upsert Facebook Page
        await supabase.from("socialbu_accounts").upsert(
          {
            platform: "facebook",
            account_name: page.name,
            socialbu_account_id: page.id,
            profile_image_url: null,
            is_active: true,
          },
          { onConflict: "socialbu_account_id" }
        ).select();

        // Upsert linked Instagram account if exists
        if (page.instagram_business_account) {
          const ig = page.instagram_business_account;
          await supabase.from("socialbu_accounts").upsert(
            {
              platform: "instagram",
              account_name: ig.username || ig.name || `IG-${ig.id}`,
              socialbu_account_id: ig.id,
              profile_image_url: ig.profile_picture_url || null,
              is_active: true,
            },
            { onConflict: "socialbu_account_id" }
          ).select();
        }
      }

      return new Response(
        JSON.stringify({ success: true, pages_count: pages.length, pages }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Disconnect ────────────────────────────────────
    if (action === "disconnect") {
      const { user_id } = params;
      await supabase
        .from("social_media_settings")
        .update({ auth_token: null, is_connected: false, api_secret_encrypted: null })
        .eq("user_id", user_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("Meta API error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
