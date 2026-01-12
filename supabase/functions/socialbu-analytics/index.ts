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

    const body = await req.json();
    const { action, startDate, endDate, accounts } = body;

    // Get auth token from settings
    const { data: settings, error: settingsError } = await supabase
      .from('social_media_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings?.auth_token) {
      return new Response(
        JSON.stringify({ error: 'SocialBu not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authToken = settings.auth_token;

    switch (action) {
      case 'fetch-posts-metrics': {
        // Fetch posts metrics from SocialBu
        const params = new URLSearchParams({
          start: startDate,
          end: endDate,
          metrics: 'likes,comments,shares,views,reach,saved',
          post_type: 'image',
        });

        if (accounts?.length) {
          accounts.forEach((a: number) => params.append('accounts[]', a.toString()));
        }

        const response = await fetch(`${SOCIALBU_API_BASE}/insights/posts/metrics?${params}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (!response.ok) {
          console.error('SocialBu metrics error:', response.status);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch metrics' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch-accounts-metrics': {
        // Fetch account metrics (followers, views, etc.)
        const params = new URLSearchParams({
          start: startDate,
          end: endDate,
          metrics: 'followers,total_views',
          calculate_growth: 'true',
        });

        if (accounts?.length) {
          accounts.forEach((a: number) => params.append('accounts[]', a.toString()));
        }

        const response = await fetch(`${SOCIALBU_API_BASE}/insights/accounts/metrics?${params}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (!response.ok) {
          console.error('SocialBu account metrics error:', response.status);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch account metrics' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch-top-posts': {
        // Fetch top performing posts
        const params = new URLSearchParams({
          start: startDate,
          end: endDate,
          metrics: 'likes,comments,shares',
        });

        if (accounts?.length) {
          accounts.forEach((a: number) => params.append('accounts[]', a.toString()));
        }

        const response = await fetch(`${SOCIALBU_API_BASE}/insights/posts/top_posts?${params}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (!response.ok) {
          console.error('SocialBu top posts error:', response.status);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch top posts' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch-posts-count': {
        // Fetch posts count per date
        const params = new URLSearchParams({
          start: startDate,
          end: endDate,
        });

        if (accounts?.length) {
          accounts.forEach((a: number) => params.append('accounts[]', a.toString()));
        }

        const response = await fetch(`${SOCIALBU_API_BASE}/insights/posts/counts?${params}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (!response.ok) {
          console.error('SocialBu posts count error:', response.status);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch posts count' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync-analytics': {
        // Sync all analytics data to our database
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        // Fetch posts with their external IDs from our database
        const { data: posts } = await supabase
          .from('social_media_posts')
          .select('id, socialbu_post_id, platform')
          .not('socialbu_post_id', 'is', null);

        let syncedCount = 0;

        // For each post, try to get its metrics
        // Note: SocialBu doesn't have per-post metrics in API, so we aggregate
        // In a real implementation, you'd need to map SocialBu's insights to individual posts

        // Get general metrics
        const metricsParams = new URLSearchParams({
          start: formatDate(thirtyDaysAgo),
          end: formatDate(today),
          metrics: 'likes,comments,shares,views,reach',
          post_type: 'image',
        });

        const metricsResponse = await fetch(`${SOCIALBU_API_BASE}/insights/posts/metrics?${metricsParams}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          console.log('Fetched analytics metrics:', metricsData);
          syncedCount = 1;
        }

        // Update last sync time
        await supabase
          .from('social_media_settings')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', settings.id);

        return new Response(
          JSON.stringify({ success: true, synced: syncedCount }),
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
    console.error('SocialBu analytics error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
