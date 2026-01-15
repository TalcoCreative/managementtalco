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

    // Get user_id from request body or auth header
    let userId: string | null = null;
    
    try {
      const body = await req.json();
      userId = body.user_id || null;
    } catch {
      // No body provided, try to get from auth
    }

    // If no user_id in body, try to get from Authorization header
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required for sync' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Syncing for user:', userId);

    // Get the API secret from settings
    const { data: settings, error: settingsError } = await supabase
      .from('social_media_settings')
      .select('*')
      .not('api_secret_encrypted', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw new Error('Failed to fetch settings');
    }

    if (!settings?.api_secret_encrypted) {
      return new Response(
        JSON.stringify({ error: 'SocialBu not connected - no API key found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use api_secret_encrypted as the API token
    const authToken = settings.api_secret_encrypted;

    console.log('Syncing posts from SocialBu...');
    console.log('API Token (first 30 chars):', authToken.substring(0, 30) + '...');

    let syncedCount = 0;
    
    try {
      // According to SocialBu API, we need to fetch posts without query params first
      // Then filter by status if needed
      // API endpoint: GET /api/v1/posts
      const response = await fetch('https://socialbu.com/api/v1/posts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('SocialBu API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('SocialBu API error response:', errorText);
        
        // Try alternative endpoint format
        console.log('Trying alternative endpoint...');
        
        const altResponse = await fetch('https://socialbu.com/api/v1/scheduled-posts', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/json',
          },
        });

        console.log('Alternative endpoint status:', altResponse.status);

        if (!altResponse.ok) {
          const altErrorText = await altResponse.text();
          console.log('Alternative endpoint error:', altErrorText);
          
          // Try fetching post history
          const historyResponse = await fetch('https://socialbu.com/api/v1/history', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Accept': 'application/json',
            },
          });

          console.log('History endpoint status:', historyResponse.status);

          if (!historyResponse.ok) {
            return new Response(
              JSON.stringify({ 
                synced: 0, 
                message: 'Unable to fetch posts. Please check your API key and ensure it has the required permissions.',
                debug: {
                  posts_status: response.status,
                  scheduled_status: altResponse.status,
                  history_status: historyResponse.status,
                }
              }),
              { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          const historyData = await historyResponse.json();
          console.log('History data keys:', Object.keys(historyData));
          const historyPosts = historyData.items || historyData.data || historyData.posts || [];
          
          syncedCount = await processPosts(supabase, historyPosts, userId);
        } else {
          const altData = await altResponse.json();
          console.log('Alternative data keys:', Object.keys(altData));
          const altPosts = altData.items || altData.data || altData.posts || [];
          
          syncedCount = await processPosts(supabase, altPosts, userId);
        }
      } else {
        const data = await response.json();
        console.log('Response data keys:', Object.keys(data));
        console.log('Response data sample:', JSON.stringify(data).substring(0, 500));
        
        const posts = data.items || data.data || data.posts || (Array.isArray(data) ? data : []);
        console.log(`Found ${posts.length} posts from SocialBu`);

        syncedCount = await processPosts(supabase, posts, userId);
      }

    } catch (apiError) {
      console.error('Error calling SocialBu API:', apiError);
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

async function processPosts(supabase: any, posts: any[], staffId: string): Promise<number> {
  let syncedCount = 0;

  for (const post of posts) {
    const externalId = post.id?.toString() || post.post_id?.toString();
    
    if (!externalId) continue;

    // Determine platform from various possible fields
    let platform = 'unknown';
    if (post.platform) {
      platform = post.platform.toLowerCase();
    } else if (post.network) {
      platform = post.network.toLowerCase();
    } else if (post.account?.type) {
      platform = post.account.type.toLowerCase();
    } else if (post.accounts && post.accounts.length > 0) {
      platform = post.accounts[0].type?.toLowerCase() || 'unknown';
    }

    // Determine content type from media
    let contentType = 'text';
    const mediaUrls = post.media_urls || post.images || post.media || [];
    if (mediaUrls.length > 0) {
      const firstMedia = typeof mediaUrls[0] === 'string' ? mediaUrls[0] : mediaUrls[0]?.url || '';
      if (firstMedia.includes('video') || firstMedia.endsWith('.mp4') || firstMedia.endsWith('.mov')) {
        contentType = 'video';
      } else if (firstMedia.includes('image') || firstMedia.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        contentType = 'image';
      }
    }
    if (post.type) {
      contentType = post.type.toLowerCase();
    }

    const postData = {
      external_id: externalId,
      staff_id: staffId,
      platform: platform,
      content_type: contentType,
      caption: post.content || post.caption || post.text || post.message || '',
      media_urls: mediaUrls,
      scheduled_at: post.scheduled_time || post.schedule_time || post.scheduled_at || null,
      posted_at: post.published_time || post.posted_at || post.published_at || post.sent_at || null,
      status: mapSocialBuStatus(post.status || post.state),
      post_url: post.post_url || post.link || post.url || null,
      live_post_url: post.post_url || post.link || post.url || null,
      synced_at: new Date().toISOString(),
    };

    console.log(`Processing post ${externalId}:`, {
      platform,
      contentType,
      status: postData.status,
      hasCaption: !!postData.caption,
    });

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

  return syncedCount;
}

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
    'completed': 'posted',
    'success': 'posted',
    'failed': 'failed',
    'error': 'failed',
    'rejected': 'failed',
  };
  
  return statusMap[status?.toLowerCase()] || 'draft';
}
