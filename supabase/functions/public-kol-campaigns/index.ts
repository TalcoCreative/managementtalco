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

    // Find client
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

    // Fetch KOL campaigns for this client with KOL info
    const { data: campaigns, error: campError } = await supabase
      .from("kol_campaigns")
      .select("id, campaign_name, platform, status, is_posted, post_link, kol_id, kol:kol_database(name, username)")
      .eq("client_id", client.id)
      .order("updated_at", { ascending: false });

    if (campError) {
      console.error("Error fetching campaigns:", campError);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      clientName: client.name,
      campaigns: (campaigns || []).map((c: any) => ({
        id: c.id,
        kol_name: c.kol?.name || "-",
        kol_username: c.kol?.username || "-",
        campaign_name: c.campaign_name,
        platform: c.platform,
        status: c.status,
        is_posted: c.is_posted,
        post_link: c.post_link,
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
