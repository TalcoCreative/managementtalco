import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOCIALBU_API_BASE = 'https://socialbu.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, email, password } = await req.json();

    // Get settings
    const { data: settings } = await supabase
      .from('social_media_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    switch (action) {
      case 'login': {
        // Authenticate with SocialBu to get access token
        const response = await fetch(`${SOCIALBU_API_BASE}/auth/get_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('SocialBu login error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: 'Login failed. Please check your credentials.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log('SocialBu login successful for:', data.email);

        // Save auth token to settings
        if (settings?.id) {
          await supabase
            .from('social_media_settings')
            .update({
              auth_token: data.authToken,
              user_email: data.email,
              is_connected: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', settings.id);
        } else {
          await supabase
            .from('social_media_settings')
            .insert({
              auth_token: data.authToken,
              user_email: data.email,
              is_connected: true,
            });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            user: { id: data.id, name: data.name, email: data.email } 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'logout': {
        if (!settings?.auth_token) {
          return new Response(
            JSON.stringify({ error: 'Not logged in' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Logout from SocialBu
        await fetch(`${SOCIALBU_API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${settings.auth_token}` },
        });

        // Clear auth token
        await supabase
          .from('social_media_settings')
          .update({
            auth_token: null,
            user_email: null,
            is_connected: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch-accounts': {
        if (!settings?.auth_token) {
          return new Response(
            JSON.stringify({ error: 'Not authenticated' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch connected accounts from SocialBu
        const response = await fetch(`${SOCIALBU_API_BASE}/accounts`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${settings.auth_token}` },
        });

        if (!response.ok) {
          console.error('SocialBu fetch accounts error:', response.status);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch accounts' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        const accounts = data.items || [];

        console.log(`Found ${accounts.length} SocialBu accounts`);

        // Sync accounts to our database
        for (const account of accounts) {
          await supabase
            .from('socialbu_accounts')
            .upsert({
              socialbu_account_id: account.id,
              platform: account.type?.toLowerCase() || account.provider?.toLowerCase() || 'unknown',
              account_name: account.name || account.username,
              account_type: account.type,
              profile_image_url: account.picture || account.avatar,
              is_active: account.connected !== false,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'socialbu_account_id' });
        }

        return new Response(
          JSON.stringify({ success: true, accounts }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'connect-account': {
        if (!settings?.auth_token) {
          return new Response(
            JSON.stringify({ error: 'Not authenticated' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { provider } = await req.json();

        // Get connect URL from SocialBu
        const response = await fetch(`${SOCIALBU_API_BASE}/accounts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.auth_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ provider }),
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to get connect URL' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, connect_url: data.connect_url }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('SocialBu accounts error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
