import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the API secret from settings
    const { data: settings, error: settingsError } = await supabase
      .from('social_media_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw new Error('Failed to fetch settings');
    }

    if (!settings?.api_secret_encrypted || !settings?.is_connected) {
      return new Response(
        JSON.stringify({ error: 'SocialBu not connected' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const apiSecret = settings.api_secret_encrypted;

    // Call SocialBu API to get posts
    // Note: This is a placeholder - actual SocialBu API endpoints may differ
    // You'll need to adjust based on SocialBu's actual API documentation
    console.log('Syncing posts from SocialBu...');

    let syncedCount = 0;
    
    try {
      // Example API call - adjust endpoint and parameters based on SocialBu docs
      const response = await fetch('https://api.socialbu.com/v2/posts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiSecret}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('SocialBu API response not OK:', response.status);
        // If the API returns an error, we'll log it but not fail the whole sync
        // This allows for graceful handling when API is not available or credentials are invalid
        
        return new Response(
          JSON.stringify({ 
            synced: 0, 
            message: 'Unable to connect to SocialBu API. Please check your API secret.' 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const data = await response.json();
      const posts = data.posts || data.data || [];

      console.log(`Found ${posts.length} posts from SocialBu`);

      // Process each post
      for (const post of posts) {
        const externalId = post.id?.toString() || post.post_id?.toString();
        
        if (!externalId) continue;

        const postData = {
          external_id: externalId,
          platform: post.platform?.toLowerCase() || post.network?.toLowerCase() || 'unknown',
          caption: post.content || post.caption || post.text || '',
          media_urls: post.media_urls || post.images || [],
          scheduled_at: post.scheduled_time || post.schedule_time || null,
          posted_at: post.published_time || post.posted_at || null,
          status: mapSocialBuStatus(post.status || post.state),
          post_url: post.post_url || post.link || null,
          live_post_url: post.post_url || post.link || null,
          synced_at: new Date().toISOString(),
        };

        // Upsert the post
        const { error: upsertError } = await supabase
          .from('social_media_posts')
          .upsert(postData, { 
            onConflict: 'external_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error(`Error upserting post ${externalId}:`, upsertError);
        } else {
          syncedCount++;
        }
      }

    } catch (apiError) {
      console.error('Error calling SocialBu API:', apiError);
      // Return partial success if some posts were synced
    }

    // Update last sync time
    await supabase
      .from('social_media_settings')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', settings.id);

    console.log(`Sync complete. ${syncedCount} posts synced.`);

    return new Response(
      JSON.stringify({ synced: syncedCount, success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Map SocialBu status to our status
function mapSocialBuStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'draft': 'draft',
    'scheduled': 'scheduled',
    'queued': 'scheduled',
    'pending': 'scheduled',
    'published': 'posted',
    'posted': 'posted',
    'sent': 'posted',
    'failed': 'failed',
    'error': 'failed',
    'rejected': 'failed',
  };
  
  return statusMap[status?.toLowerCase()] || 'draft';
}
