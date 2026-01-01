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

    console.log("Shared meeting request with token:", token);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase configuration");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch meeting by share_token (skip confidential meetings)
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select(`
        id,
        title,
        meeting_date,
        start_time,
        end_time,
        location,
        meeting_link,
        mode,
        type,
        status,
        notes,
        original_date,
        reschedule_reason,
        is_confidential,
        clients(name),
        projects(title)
      `)
      .eq("share_token", token)
      .eq("is_confidential", false)
      .maybeSingle();

    if (meetingError) {
      console.error("Error fetching meeting:", meetingError);
      return json({ error: "Failed to fetch meeting" }, 500);
    }

    if (!meeting) {
      console.log("Meeting not found for token:", token);
      return json({ error: "Meeting not found or is confidential" }, 404);
    }

    console.log("Found meeting:", meeting.id);

    // Fetch internal participants
    const { data: participants, error: participantsError } = await supabase
      .from("meeting_participants")
      .select(`
        id,
        status,
        user:profiles(full_name)
      `)
      .eq("meeting_id", meeting.id);

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
    }

    // Fetch external participants
    const { data: externalParticipants, error: externalError } = await supabase
      .from("meeting_external_participants")
      .select("id, name, company")
      .eq("meeting_id", meeting.id);

    if (externalError) {
      console.error("Error fetching external participants:", externalError);
    }

    return json({
      meeting,
      participants: participants || [],
      externalParticipants: externalParticipants || [],
    });
  } catch (error) {
    console.error("Error in shared-meeting function:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
