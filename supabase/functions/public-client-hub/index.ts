import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing slug parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for public access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find client by dashboard_slug (which is the hub slug)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, company, dashboard_slug, social_media_slug, status")
      .eq("dashboard_slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (clientError) {
      console.error("Error fetching client:", clientError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for projects (for Dashboard)
    const { count: projectCount } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id);

    // Check for platform accounts (for Reports)
    const { count: platformCount } = await supabase
      .from("platform_accounts")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id);

    // Check if client has editorial plans
    const { count: epCount } = await supabase
      .from("editorial_plans")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id);

    const response = {
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        dashboard_slug: client.dashboard_slug,
        social_media_slug: client.social_media_slug,
      },
      hasProjects: (projectCount || 0) > 0,
      hasReports: (platformCount || 0) > 0,
      hasSocialMedia: !!client.social_media_slug,
      hasEditorialPlans: (epCount || 0) > 0,
    };

    console.log("Public client hub response:", response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in public-client-hub:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
