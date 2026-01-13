import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOCIALBU_API_BASE = "https://socialbu.com/api/v1";

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Verify the user is authenticated to THIS app (JWT comes from the browser)
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      console.warn("socialbu-accounts: missing/invalid user session", userError?.message);
      return json(401, { error: "Not authenticated" });
    }

    // 2) Use service role for DB reads/writes (so we don't depend on RLS here)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({} as any));
    const { action, api_key, provider } = body ?? {};

    if (!action) return json(400, { error: "Missing action" });

    console.log("SocialBu accounts action:", action, "user:", user.id);

    // Get settings - try user-specific first, then fallback to global settings
    let settings: any = null;
    
    // First try to get user-specific settings
    const { data: userSettings, error: userSettingsError } = await supabaseAdmin
      .from("social_media_settings")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!userSettingsError && userSettings) {
      settings = userSettings;
    } else {
      // Fallback: get any settings with api_secret_encrypted (global/shared settings)
      const { data: globalSettings, error: globalError } = await supabaseAdmin
        .from("social_media_settings")
        .select("*")
        .not("api_secret_encrypted", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!globalError && globalSettings) {
        settings = globalSettings;
      }
    }

    // Get the API token (prioritize api_secret_encrypted over auth_token)
    const apiToken = settings?.api_secret_encrypted || settings?.auth_token;

    switch (action) {
      case "save-api-key": {
        if (!api_key?.trim()) {
          return json(400, { error: "API key is required" });
        }

        // Save API key to settings for this user
        const { error: upsertError } = await supabaseAdmin
          .from("social_media_settings")
          .upsert(
            {
              user_id: user.id,
              api_secret_encrypted: api_key,
              is_connected: true,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            },
            { onConflict: "user_id" }
          );

        if (upsertError) {
          console.error("socialbu-accounts: failed to save API key", upsertError);
          return json(500, { error: "Failed to save API key" });
        }

        return json(200, { success: true, message: "API key saved successfully" });
      }

      case "logout": {
        // Clear API token
        const { error: logoutError } = await supabaseAdmin
          .from("social_media_settings")
          .update({
            api_secret_encrypted: null,
            auth_token: null,
            user_email: null,
            is_connected: false,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("user_id", user.id);

        if (logoutError) {
          // Try updating by settings id if user_id fails
          if (settings?.id) {
            await supabaseAdmin
              .from("social_media_settings")
              .update({
                api_secret_encrypted: null,
                auth_token: null,
                user_email: null,
                is_connected: false,
                updated_at: new Date().toISOString(),
                updated_by: user.id,
              })
              .eq("id", settings.id);
          }
        }

        return json(200, { success: true });
      }

      case "fetch-accounts": {
        if (!apiToken) {
          console.log("No API token found. Settings:", {
            hasSettings: !!settings,
            hasApiSecret: !!settings?.api_secret_encrypted,
            hasAuthToken: !!settings?.auth_token,
            isConnected: settings?.is_connected
          });
          return json(401, { error: "No API key configured. Please add your SocialBu API key in settings." });
        }

        console.log("Fetching accounts with API token (first 20 chars):", apiToken.substring(0, 20) + "...");

        // Fetch connected accounts from SocialBu using Bearer token
        const response = await fetch(`${SOCIALBU_API_BASE}/accounts`, {
          method: "GET",
          headers: { 
            "Authorization": `Bearer ${apiToken}`,
            "Accept": "application/json",
          },
        });

        console.log("SocialBu API response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error("SocialBu fetch accounts error:", response.status, errorText);

          // Token may have expired/revoked
          if (response.status === 401 || response.status === 403) {
            // Don't clear the token, just return error
            return json(response.status, { 
              error: "API key is invalid or expired. Please update your SocialBu API key.",
              needs_reauth: true 
            });
          }

          return json(response.status, { error: "Failed to fetch accounts from SocialBu" });
        }

        const data = await response.json();
        console.log("SocialBu API response data:", JSON.stringify(data).substring(0, 500));
        
        // Handle different response formats
        const accounts = data.items || data.data || data.accounts || (Array.isArray(data) ? data : []);

        console.log(`Found ${accounts.length} SocialBu accounts`);

        // Sync accounts to our database
        for (const account of accounts) {
          const platform = (account.type || account.provider || account.platform || "unknown").toLowerCase();
          const accountName = account.name || account.username || account.account_name || `${platform} account`;
          
          const { error: upsertAccountError } = await supabaseAdmin
            .from("socialbu_accounts")
            .upsert(
              {
                socialbu_account_id: String(account.id),
                platform: platform,
                account_name: accountName,
                account_type: account.type || account.account_type,
                profile_image_url: account.picture || account.avatar || account.profile_image_url,
                is_active: account.connected !== false && account.active !== false,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "socialbu_account_id" }
            );

          if (upsertAccountError) {
            console.error("socialbu-accounts: failed to upsert account", account.id, upsertAccountError);
          }
        }

        // Update last sync time
        if (settings?.id) {
          await supabaseAdmin
            .from("social_media_settings")
            .update({
              last_sync_at: new Date().toISOString(),
              is_connected: true,
            })
            .eq("id", settings.id);
        }

        return json(200, { success: true, accounts, count: accounts.length });
      }

      case "connect-account": {
        if (!apiToken) return json(401, { error: "No API key configured" });
        if (!provider?.trim()) return json(400, { error: "Missing provider" });

        console.log("Connecting account for provider:", provider);

        // Get connect URL from SocialBu
        const response = await fetch(`${SOCIALBU_API_BASE}/accounts`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ provider }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error("SocialBu connect account error:", response.status, errorText);
          return json(response.status, { error: "Failed to get connect URL" });
        }

        const data = await response.json();
        return json(200, { success: true, connect_url: data.connect_url || data.url });
      }

      case "check-connection": {
        // Check if we have a valid API token
        const hasToken = !!apiToken;
        const isConnected = settings?.is_connected && hasToken;

        return json(200, {
          is_connected: isConnected,
          has_api_key: hasToken,
          last_sync_at: settings?.last_sync_at,
        });
      }

      default:
        return json(400, { error: "Invalid action" });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("SocialBu accounts error:", errorMessage);
    return json(500, { error: errorMessage });
  }
});
