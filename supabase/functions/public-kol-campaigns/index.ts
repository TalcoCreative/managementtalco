import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("dashboard_slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assigned KOLs (pivot) — clients only see the listing for their client
    const { data: assigned } = await supabase
      .from("kol_database_clients")
      .select("kol:kol_database(id, name, username, category, industry, ig_followers, tiktok_followers, youtube_followers, twitter_followers, linkedin_followers, threads_followers, instagram_url, tiktok_url, youtube_url, twitter_url, linkedin_url, threads_url, rate_cards, rate_ig_story, rate_ig_feed, rate_ig_reels, rate_tiktok_video, rate_youtube_video)")
      .eq("client_id", client.id);

    // Campaigns for this client
    const { data: campaigns, error: campError } = await supabase
      .from("kol_campaigns")
      .select("id, campaign_name, platform, status, is_posted, post_link, fee, is_paid, paid_at, created_at, updated_at, kol_id, kol:kol_database(name, username)")
      .eq("client_id", client.id)
      .order("updated_at", { ascending: false });

    if (campError) {
      console.error("Error fetching campaigns:", campError);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizeRateCards = (k: any): any[] => {
      const cards = Array.isArray(k?.rate_cards) ? k.rate_cards : [];
      if (cards.length > 0) return cards;
      // Backfill from legacy columns
      const legacy: any[] = [];
      if (k?.rate_ig_story) legacy.push({ platform: "instagram", content_type: "story", rate: Number(k.rate_ig_story) });
      if (k?.rate_ig_feed) legacy.push({ platform: "instagram", content_type: "feed", rate: Number(k.rate_ig_feed) });
      if (k?.rate_ig_reels) legacy.push({ platform: "instagram", content_type: "reels", rate: Number(k.rate_ig_reels) });
      if (k?.rate_tiktok_video) legacy.push({ platform: "tiktok", content_type: "video", rate: Number(k.rate_tiktok_video) });
      if (k?.rate_youtube_video) legacy.push({ platform: "youtube", content_type: "video", rate: Number(k.rate_youtube_video) });
      return legacy;
    };

    const kols = (assigned || [])
      .map((row: any) => row.kol)
      .filter(Boolean)
      .map((k: any) => ({
        id: k.id,
        name: k.name,
        username: k.username,
        category: k.category,
        industry: k.industry,
        followers: {
          instagram: k.ig_followers,
          tiktok: k.tiktok_followers,
          youtube: k.youtube_followers,
          twitter: k.twitter_followers,
          linkedin: k.linkedin_followers,
          threads: k.threads_followers,
        },
        links: {
          instagram: k.instagram_url,
          tiktok: k.tiktok_url,
          youtube: k.youtube_url,
          twitter: k.twitter_url,
          linkedin: k.linkedin_url,
          threads: k.threads_url,
        },
        rate_cards: normalizeRateCards(k),
      }));

    const result = {
      clientName: client.name,
      kols,
      campaigns: (campaigns || []).map((c: any) => ({
        id: c.id,
        kol_name: c.kol?.name || "-",
        kol_username: c.kol?.username || "-",
        campaign_name: c.campaign_name,
        platform: c.platform,
        status: c.status,
        is_posted: c.is_posted,
        post_link: c.post_link,
        budget: c.fee,
        is_paid: c.is_paid,
        paid_at: c.paid_at,
        created_at: c.created_at,
        updated_at: c.updated_at,
        posted_at: c.is_posted ? c.updated_at : null,
      })),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
