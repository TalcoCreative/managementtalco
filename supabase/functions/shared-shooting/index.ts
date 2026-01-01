import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let token: string | null = null;

    // Get token from query params or body
    const url = new URL(req.url);
    token = url.searchParams.get("token");

    if (!token && req.method === "POST") {
      const body = await req.json();
      token = body.token;
    }

    if (!token) {
      return json({ error: "Token is required" }, 400);
    }

    console.log("Shared shooting request with token:", token);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase configuration");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch shooting by share_token
    const { data: shooting, error: shootingError } = await supabase
      .from("shooting_schedules")
      .select(`
        id,
        title,
        scheduled_date,
        scheduled_time,
        location,
        status,
        notes,
        rescheduled_from,
        reschedule_reason,
        cancelled_at,
        cancel_reason,
        clients(name),
        projects(title),
        director_profile:profiles!fk_shooting_director_profiles(full_name),
        runner_profile:profiles!fk_shooting_runner_profiles(full_name)
      `)
      .eq("share_token", token)
      .maybeSingle();

    if (shootingError) {
      console.error("Error fetching shooting:", shootingError);
      return json({ error: "Failed to fetch shooting" }, 500);
    }

    if (!shooting) {
      console.log("Shooting not found for token:", token);
      return json({ error: "Shooting not found" }, 404);
    }

    console.log("Found shooting:", shooting.id);

    // Fetch crew for this shooting
    const { data: crew, error: crewError } = await supabase
      .from("shooting_crew")
      .select(`
        id,
        role,
        is_freelance,
        freelance_name,
        profiles(full_name)
      `)
      .eq("shooting_id", shooting.id);

    if (crewError) {
      console.error("Error fetching crew:", crewError);
    }

    return json({
      shooting,
      crew: crew || [],
    });
  } catch (error) {
    console.error("Error in shared-shooting function:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
