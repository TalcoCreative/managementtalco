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

    const { action, postId, postData } = await req.json();

    // Get auth token from settings
    const { data: settings, error: settingsError } = await supabase
      .from('social_media_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings?.auth_token) {
      return new Response(
        JSON.stringify({ error: 'SocialBu not authenticated. Please login first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authToken = settings.auth_token;

    switch (action) {
      case 'create': {
        // Create a new post in SocialBu
        const response = await fetch(`${SOCIALBU_API_BASE}/posts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accounts: postData.accounts,
            content: postData.content,
            publish_at: postData.publish_at,
            draft: postData.draft || false,
            existing_attachments: postData.existing_attachments || [],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('SocialBu create post error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: `Failed to create post: ${response.status}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await response.json();
        console.log('Post created in SocialBu:', result);

        // Store reference in our database
        if (result.posts && result.posts.length > 0 && postId) {
          const socialbuPostId = result.posts[0]?.id;
          await supabase
            .from('social_media_posts')
            .update({ 
              socialbu_post_id: socialbuPostId,
              status: postData.draft ? 'draft' : 'scheduled'
            })
            .eq('id', postId);
        }

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        // Update existing post in SocialBu
        const { socialbuPostId } = postData;
        const response = await fetch(`${SOCIALBU_API_BASE}/posts/${socialbuPostId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: postData.content,
            publish_at: postData.publish_at,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('SocialBu update post error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: `Failed to update post: ${response.status}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await response.json();
        return new Response(
          JSON.stringify({ success: true, data: result }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        // Delete post from SocialBu
        const { socialbuPostId } = postData;
        const response = await fetch(`${SOCIALBU_API_BASE}/posts/${socialbuPostId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('SocialBu delete post error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: `Failed to delete post: ${response.status}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
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
    console.error('SocialBu post error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
