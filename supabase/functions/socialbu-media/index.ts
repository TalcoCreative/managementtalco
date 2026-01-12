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

    const { action, fileName, mimeType, mediaKey } = await req.json();

    // Get auth token from settings
    const { data: settings } = await supabase
      .from('social_media_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!settings?.auth_token) {
      return new Response(
        JSON.stringify({ error: 'SocialBu not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authToken = settings.auth_token;

    switch (action) {
      case 'initiate-upload': {
        // Get signed URL for media upload
        const response = await fetch(`${SOCIALBU_API_BASE}/upload_media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: fileName,
            mime_type: mimeType,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('SocialBu upload initiate error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to initiate upload' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ 
            success: true, 
            signed_url: data.signed_url,
            key: data.key,
            secure_key: data.secure_key,
            url: data.url,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check-status': {
        // Check media upload status
        const response = await fetch(`${SOCIALBU_API_BASE}/upload_media/status?key=${encodeURIComponent(mediaKey)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (!response.ok) {
          console.error('SocialBu upload status error:', response.status);
          return new Response(
            JSON.stringify({ error: 'Failed to check upload status' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ 
            success: true, 
            upload_token: data.upload_token,
            message: data.message,
          }),
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
    console.error('SocialBu media error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
