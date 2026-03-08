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
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Missing slug parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find client by dashboard_slug
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, company, dashboard_slug, client_logo")
      .eq("dashboard_slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch marketplace reports for this client and year
    const { data: reports, error: reportsError } = await supabase
      .from("marketplace_reports")
      .select("*")
      .eq("client_id", client.id)
      .eq("report_year", year)
      .order("report_month", { ascending: true });

    if (reportsError) {
      console.error("Error fetching marketplace reports:", reportsError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get available years
    const { data: yearData } = await supabase
      .from("marketplace_reports")
      .select("report_year")
      .eq("client_id", client.id)
      .order("report_year", { ascending: false });

    const availableYears = [...new Set((yearData || []).map((r: any) => r.report_year))];

    return new Response(
      JSON.stringify({
        client: {
          id: client.id,
          name: client.name,
          company: client.company,
          dashboard_slug: client.dashboard_slug,
          client_logo: client.client_logo,
        },
        reports: reports || [],
        availableYears,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in public-marketplace:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
