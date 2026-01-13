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
    const { action, email, password, provider } = body ?? {};

    if (!action) return json(400, { error: "Missing action" });

    console.log("SocialBu accounts action:", action, "user:", user.id);

    // Get settings for this user (latest row)
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("social_media_settings")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("socialbu-accounts: failed to fetch settings", settingsError);
      return json(500, { error: "Failed to load settings" });
    }

    switch (action) {
      case "login": {
        if (!email?.trim() || !password?.trim()) {
          return json(400, { error: "Email and password are required" });
        }

        // Authenticate with SocialBu to get access token
        const response = await fetch(`${SOCIALBU_API_BASE}/auth/get_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("SocialBu login error:", response.status, errorText);
          return json(401, { error: "Login failed. Please check your credentials." });
        }

        const data = await response.json();
        console.log("SocialBu login successful for:", data.email);

        // Save auth token to settings scoped to this user
        const { error: upsertError } = await supabaseAdmin
          .from("social_media_settings")
          .upsert(
            {
              user_id: user.id,
              auth_token: data.authToken,
              user_email: data.email,
              is_connected: true,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            },
            { onConflict: "user_id" }
          );

        if (upsertError) {
          console.error("socialbu-accounts: failed to save settings", upsertError);
          return json(500, { error: "Failed to save login" });
        }

        return json(200, {
          success: true,
          user: { id: data.id, name: data.name, email: data.email },
        });
      }

      case "logout": {
        if (!settings?.auth_token) {
          // Heal inconsistent state if needed
          if (settings?.is_connected) {
            await supabaseAdmin
              .from("social_media_settings")
              .update({
                is_connected: false,
                user_email: null,
                updated_at: new Date().toISOString(),
                updated_by: user.id,
              })
              .eq("user_id", user.id);
          }
          return json(400, { error: "Not logged in" });
        }

        // Logout from SocialBu (best-effort)
        await fetch(`${SOCIALBU_API_BASE}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${settings.auth_token}` },
        }).catch(() => null);

        // Clear auth token
        const { error: logoutError } = await supabaseAdmin
          .from("social_media_settings")
          .update({
            auth_token: null,
            user_email: null,
            is_connected: false,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("user_id", user.id);

        if (logoutError) {
          console.error("socialbu-accounts: failed to clear settings", logoutError);
          return json(500, { error: "Failed to logout" });
        }

        return json(200, { success: true });
      }

      case "fetch-accounts": {
        if (!settings?.auth_token) {
          // If DB says connected but token is missing, auto-fix it.
          if (settings?.is_connected) {
            await supabaseAdmin
              .from("social_media_settings")
              .update({
                is_connected: false,
                user_email: null,
                updated_at: new Date().toISOString(),
                updated_by: user.id,
              })
              .eq("user_id", user.id);
          }
          return json(401, { error: "Not logged in" });
        }

        // Fetch connected accounts from SocialBu
        const response = await fetch(`${SOCIALBU_API_BASE}/accounts`, {
          method: "GET",
          headers: { Authorization: `Bearer ${settings.auth_token}` },
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error("SocialBu fetch accounts error:", response.status, errorText);

          // Token may have expired/revoked; don't keep the UI stuck in a connected state.
          if (response.status === 401 || response.status === 403) {
            await supabaseAdmin
              .from("social_media_settings")
              .update({
                auth_token: null,
                is_connected: false,
                updated_at: new Date().toISOString(),
                updated_by: user.id,
              })
              .eq("user_id", user.id);
          }

          return json(response.status, { error: "Failed to fetch accounts" });
        }

        const data = await response.json();
        const accounts = data.items || [];

        console.log(`Found ${accounts.length} SocialBu accounts`);

        // Sync accounts to our database
        for (const account of accounts) {
          const { error: upsertAccountError } = await supabaseAdmin
            .from("socialbu_accounts")
            .upsert(
              {
                socialbu_account_id: account.id,
                platform: account.type?.toLowerCase() || account.provider?.toLowerCase() || "unknown",
                account_name: account.name || account.username,
                account_type: account.type,
                profile_image_url: account.picture || account.avatar,
                is_active: account.connected !== false,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "socialbu_account_id" }
            );

          if (upsertAccountError) {
            console.error("socialbu-accounts: failed to upsert account", upsertAccountError);
          }
        }

        return json(200, { success: true, accounts });
      }

      case "connect-account": {
        if (!settings?.auth_token) return json(401, { error: "Not logged in" });
        if (!provider?.trim()) return json(400, { error: "Missing provider" });

        console.log("Connecting account for provider:", provider);

        // Get connect URL from SocialBu
        const response = await fetch(`${SOCIALBU_API_BASE}/accounts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.auth_token}`,
            "Content-Type": "application/json",
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

      default:
        return json(400, { error: "Invalid action" });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("SocialBu accounts error:", errorMessage);
    return json(500, { error: errorMessage });
  }
});
