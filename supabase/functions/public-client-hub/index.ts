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

    // Check for meetings (non-confidential)
    const { count: meetingCount } = await supabase
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("is_confidential", false);

    // Check for shootings (all statuses)
    const { count: shootingCount } = await supabase
      .from("shooting_schedules")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id);

    // --- Fetch schedule items (upcoming/recent) ---
    const today = new Date().toISOString().split("T")[0];

    // Fetch upcoming external meetings (non-confidential, not cancelled)
    const { data: upcomingMeetings } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, start_time, end_time, mode, location, meeting_link, status")
      .eq("client_id", client.id)
      .eq("is_confidential", false)
      .eq("type", "external")
      .neq("status", "cancelled")
      .gte("meeting_date", today)
      .order("meeting_date", { ascending: true })
      .limit(20);

    // Fetch upcoming shootings (approved or pending)
    const { data: upcomingShootings } = await supabase
      .from("shooting_schedules")
      .select("id, title, scheduled_date, scheduled_time, location, status")
      .eq("client_id", client.id)
      .in("status", ["approved", "pending"])
      .gte("scheduled_date", today)
      .order("scheduled_date", { ascending: true })
      .limit(20);

    // Fetch editorial plans
    const { data: editorialPlans } = await supabase
      .from("editorial_plans")
      .select("id, title, period, slug")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Build unified schedule items
    const scheduleItems: any[] = [];

    (upcomingMeetings || []).forEach((m: any) => {
      scheduleItems.push({
        id: m.id,
        type: "meeting",
        title: m.title,
        date: m.meeting_date,
        time: m.start_time || null,
        endTime: m.end_time || null,
        location: m.location || null,
        mode: m.mode || null,
        meetingLink: m.meeting_link || null,
        status: m.status,
      });
    });

    (upcomingShootings || []).forEach((s: any) => {
      scheduleItems.push({
        id: s.id,
        type: "shooting",
        title: s.title,
        date: s.scheduled_date,
        time: s.scheduled_time || null,
        endTime: null,
        location: s.location || null,
        mode: null,
        meetingLink: null,
        status: s.status,
      });
    });

    // Sort schedule items by date then time
    scheduleItems.sort((a, b) => {
      const dateCompare = (a.date || "").localeCompare(b.date || "");
      if (dateCompare !== 0) return dateCompare;
      return (a.time || "").localeCompare(b.time || "");
    });

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
      hasMeetings: (meetingCount || 0) > 0,
      hasShootings: (shootingCount || 0) > 0,
      schedule: scheduleItems,
      editorialPlans: editorialPlans || [],
    };

    console.log("Public client hub response:", {
      client: client.name,
      scheduleItems: scheduleItems.length,
      editorialPlans: (editorialPlans || []).length,
    });

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
