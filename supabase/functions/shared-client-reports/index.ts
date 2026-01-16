import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const year = url.searchParams.get("year") || new Date().getFullYear().toString();

    if (!slug) {
      return json({ error: "Missing slug parameter" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase configuration");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client by dashboard_slug
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, company, status, dashboard_slug")
      .eq("dashboard_slug", slug)
      .maybeSingle();

    if (clientError) {
      console.error("Error fetching client:", clientError);
      return json({ error: "Failed to fetch client" }, 500);
    }

    if (!client) {
      return json({ error: "Client not found" }, 404);
    }

    // Fetch platform accounts for this client
    const { data: accounts, error: accountsError } = await supabase
      .from("platform_accounts")
      .select("id, platform, account_name, account_id")
      .eq("client_id", client.id)
      .order("platform");

    if (accountsError) {
      console.error("Error fetching accounts:", accountsError);
      return json({ error: "Failed to fetch accounts" }, 500);
    }

    // Fetch organic reports for this client
    const { data: organicReports, error: organicError } = await supabase
      .from("organic_reports")
      .select(`
        *,
        platform_accounts(id, platform, account_name)
      `)
      .eq("client_id", client.id)
      .eq("report_year", parseInt(year))
      .order("report_month", { ascending: true });

    if (organicError) {
      console.error("Error fetching organic reports:", organicError);
      return json({ error: "Failed to fetch organic reports" }, 500);
    }

    // Fetch ads reports for this client
    const { data: adsReports, error: adsError } = await supabase
      .from("ads_reports")
      .select("*")
      .eq("client_id", client.id)
      .eq("report_year", parseInt(year))
      .order("report_month", { ascending: true });

    if (adsError) {
      console.error("Error fetching ads reports:", adsError);
      return json({ error: "Failed to fetch ads reports" }, 500);
    }

    return json({
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        status: client.status,
      },
      accounts: accounts || [],
      organicReports: organicReports || [],
      adsReports: adsReports || [],
      year: parseInt(year),
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
