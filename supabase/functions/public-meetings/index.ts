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
       .select("id, name, company, dashboard_slug")
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

      // Fetch all non-confidential external meetings for the client
      const { data: meetings, error: meetingsError } = await supabase
        .from("meetings")
        .select(`
          id, title, meeting_date, start_time, end_time, mode, 
          location, meeting_link, status, type, project_id, created_by
        `)
        .eq("client_id", client.id)
        .eq("is_confidential", false)
        .eq("type", "external")
        .order("meeting_date", { ascending: false });
 
     if (meetingsError) {
       console.error("Error fetching meetings:", meetingsError);
       return new Response(
         JSON.stringify({ error: "Database error" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }

     const meetingIds = (meetings || []).map((m: any) => m.id);

     // Fetch projects, MOM, participants, external participants in parallel
     const projectIds = [...new Set((meetings || []).filter((m: any) => m.project_id).map((m: any) => m.project_id))];
     
     const [projectsResult, momResult, participantsResult, extParticipantsResult, creatorsResult] = await Promise.all([
       projectIds.length > 0
         ? supabase.from("projects").select("id, title").in("id", projectIds)
         : { data: [] },
       meetingIds.length > 0
         ? supabase.from("meeting_minutes").select("id, meeting_id, content, created_at, created_by").in("meeting_id", meetingIds).order("created_at", { ascending: false })
         : { data: [] },
       meetingIds.length > 0
         ? supabase.from("meeting_participants").select("meeting_id, user_id, status, profiles:user_id(full_name)").in("meeting_id", meetingIds)
         : { data: [] },
       meetingIds.length > 0
         ? supabase.from("meeting_external_participants").select("meeting_id, name, company").in("meeting_id", meetingIds)
         : { data: [] },
       // Get creator names
       (() => {
         const creatorIds = [...new Set((meetings || []).filter((m: any) => m.created_by).map((m: any) => m.created_by))];
         return creatorIds.length > 0
           ? supabase.from("profiles").select("id, full_name").in("id", creatorIds)
           : { data: [] };
       })(),
     ]);

     const projectMap: Record<string, string> = {};
     (projectsResult.data || []).forEach((p: any) => { projectMap[p.id] = p.title; });

     const creatorMap: Record<string, string> = {};
     (creatorsResult.data || []).forEach((c: any) => { creatorMap[c.id] = c.full_name; });

     // Group MOM by meeting_id
     const momByMeeting: Record<string, any[]> = {};
     (momResult.data || []).forEach((m: any) => {
       if (!momByMeeting[m.meeting_id]) momByMeeting[m.meeting_id] = [];
       momByMeeting[m.meeting_id].push(m);
     });

     // Group participants by meeting_id
     const participantsByMeeting: Record<string, any[]> = {};
     (participantsResult.data || []).forEach((p: any) => {
       if (!participantsByMeeting[p.meeting_id]) participantsByMeeting[p.meeting_id] = [];
       participantsByMeeting[p.meeting_id].push({ full_name: p.profiles?.full_name, status: p.status });
     });

     const extParticipantsByMeeting: Record<string, any[]> = {};
     (extParticipantsResult.data || []).forEach((p: any) => {
       if (!extParticipantsByMeeting[p.meeting_id]) extParticipantsByMeeting[p.meeting_id] = [];
       extParticipantsByMeeting[p.meeting_id].push({ name: p.name, company: p.company });
     });

     const formattedMeetings = (meetings || []).map((m: any) => {
       const { project_id, created_by, ...rest } = m;
       return {
         ...rest,
         project: project_id ? { name: projectMap[project_id] || null } : null,
         creator: created_by ? { full_name: creatorMap[created_by] || null } : null,
         mom: momByMeeting[m.id] || [],
         participants: participantsByMeeting[m.id] || [],
         external_participants: extParticipantsByMeeting[m.id] || [],
       };
     });
 
     console.log(`Public meetings for ${client.name}: ${formattedMeetings.length} found`);
 
     return new Response(
       JSON.stringify({ client, meetings: formattedMeetings }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Error in public-meetings:", error);
     return new Response(
       JSON.stringify({ error: "Internal server error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });