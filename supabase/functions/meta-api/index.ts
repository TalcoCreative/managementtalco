import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_API_VERSION = "v19.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    const getMetaCredentials = async (userId: string) => {
      const { data } = await supabase
        .from("social_media_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    };

    const jsonResponse = (body: any, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ─── Save Credentials ────────────────────────────
    if (action === "save-credentials") {
      const { user_id, meta_app_id, meta_app_secret, meta_access_token } = params;
      if (!user_id) throw new Error("User ID required");
      if (!meta_access_token) throw new Error("Access Token required");

      // Validate token against Meta API
      let isValid = false;
      let tokenInfo: any = null;
      let tokenExpiry: string | null = null;

      try {
        const res = await fetch(
          `${META_BASE}/me?fields=id,name&access_token=${meta_access_token}`
        );
        tokenInfo = await res.json();
        isValid = !tokenInfo.error;
      } catch {
        isValid = false;
      }

      // Try to extend to long-lived token if app_id and app_secret provided
      let finalToken = meta_access_token;
      if (isValid && meta_app_id && meta_app_secret) {
        try {
          const extendRes = await fetch(
            `${META_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${meta_app_id}&client_secret=${meta_app_secret}&fb_exchange_token=${meta_access_token}`
          );
          const extendData = await extendRes.json();
          if (extendData.access_token) {
            finalToken = extendData.access_token;
            // Long-lived tokens last ~60 days
            if (extendData.expires_in) {
              const expiryDate = new Date(Date.now() + extendData.expires_in * 1000);
              tokenExpiry = expiryDate.toISOString();
            }
          }
        } catch {
          // If extension fails, use original token
        }
      }

      // Check token debug info
      let tokenType = "unknown";
      if (isValid && meta_app_id && meta_app_secret) {
        try {
          const debugRes = await fetch(
            `${META_BASE}/debug_token?input_token=${finalToken}&access_token=${meta_app_id}|${meta_app_secret}`
          );
          const debugData = await debugRes.json();
          if (debugData.data) {
            tokenType = debugData.data.type || "unknown";
            if (debugData.data.expires_at && debugData.data.expires_at > 0) {
              tokenExpiry = new Date(debugData.data.expires_at * 1000).toISOString();
            }
            if (debugData.data.expires_at === 0) {
              tokenExpiry = null; // Never expires
              tokenType = "permanent";
            }
          }
        } catch {}
      }

      // Upsert settings
      const { data: existing } = await supabase
        .from("social_media_settings")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      const settingsData: any = {
        user_id,
        auth_token: finalToken,
        api_secret_encrypted: meta_app_secret || null,
        is_connected: isValid,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("social_media_settings").update(settingsData).eq("id", existing.id);
      } else {
        await supabase.from("social_media_settings").insert(settingsData);
      }

      return jsonResponse({
        success: true,
        is_connected: isValid,
        user_name: tokenInfo?.name,
        token_type: tokenType,
        token_extended: finalToken !== meta_access_token,
        token_expires_at: tokenExpiry,
        message: isValid
          ? `Connected as ${tokenInfo?.name || "Meta User"}${finalToken !== meta_access_token ? " (token extended to long-lived)" : ""}`
          : "Token saved but could not verify. Check your access token.",
      });
    }

    // ─── Check Connection ────────────────────────────
    if (action === "check-connection") {
      const { user_id } = params;
      const creds = await getMetaCredentials(user_id);

      if (!creds?.auth_token) {
        return jsonResponse({ is_connected: false, has_token: false });
      }

      try {
        const res = await fetch(
          `${META_BASE}/me?fields=id,name&access_token=${creds.auth_token}`
        );
        const data = await res.json();
        const isValid = !data.error;

        if (!isValid && creds.is_connected) {
          await supabase
            .from("social_media_settings")
            .update({ is_connected: false })
            .eq("id", creds.id);
        }

        return jsonResponse({
          is_connected: isValid,
          has_token: true,
          user_name: data.name,
          user_id: data.id,
        });
      } catch {
        return jsonResponse({ is_connected: false, has_token: true, error: "Network error" });
      }
    }

    // ─── Fetch Pages & Instagram ─────────────────────
    if (action === "fetch-pages") {
      const { user_id } = params;
      const creds = await getMetaCredentials(user_id);
      if (!creds?.auth_token) throw new Error("Meta access token not configured");

      // Fetch all Pages with linked IG accounts
      const res = await fetch(
        `${META_BASE}/me/accounts?fields=id,name,access_token,category,picture{url},instagram_business_account{id,name,username,profile_picture_url,followers_count,media_count}&limit=100&access_token=${creds.auth_token}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const pages = data.data || [];
      let igCount = 0;

      // Clear old accounts for this user and re-sync
      // First delete existing ones linked to this user
      await supabase.from("social_media_accounts").delete().eq("user_id", user_id);

      for (const page of pages) {
        // Insert Facebook Page
        await supabase.from("social_media_accounts").insert({
          user_id,
          platform: "facebook",
          account_name: page.name,
          page_id: page.id,
          access_token: page.access_token,
          status: "connected",
          is_connected: true,
          avatar_url: page.picture?.data?.url || null,
          category: page.category || null,
        });

        // Insert linked Instagram account if exists
        if (page.instagram_business_account) {
          const ig = page.instagram_business_account;
          igCount++;
          await supabase.from("social_media_accounts").insert({
            user_id,
            platform: "instagram",
            account_name: ig.username || ig.name || `IG-${ig.id}`,
            page_id: page.id, // Parent FB page
            ig_user_id: ig.id,
            access_token: page.access_token, // IG uses parent page token
            status: "connected",
            is_connected: true,
            avatar_url: ig.profile_picture_url || null,
            followers_count: ig.followers_count || null,
            media_count: ig.media_count || null,
          });
        }
      }

      return jsonResponse({
        success: true,
        pages_count: pages.length,
        ig_count: igCount,
        pages: pages.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          has_instagram: !!p.instagram_business_account,
          ig_username: p.instagram_business_account?.username || null,
        })),
      });
    }

    // ─── Disconnect ──────────────────────────────────
    if (action === "disconnect") {
      const { user_id } = params;
      await supabase
        .from("social_media_settings")
        .update({ auth_token: null, is_connected: false, api_secret_encrypted: null })
        .eq("user_id", user_id);

      // Also mark all accounts as disconnected
      await supabase
        .from("social_media_accounts")
        .update({ is_connected: false, status: "disconnected" })
        .eq("user_id", user_id);

      return jsonResponse({ success: true });
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
