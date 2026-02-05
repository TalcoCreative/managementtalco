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
 
     // Fetch all non-confidential meetings for the client
     const { data: meetings, error: meetingsError } = await supabase
       .from("meetings")
       .select(`
         id, title, meeting_date, start_time, end_time, mode, 
         location, meeting_link, status, type,
         projects(name)
       `)
       .eq("client_id", client.id)
       .eq("is_confidential", false)
       .order("meeting_date", { ascending: false });
 
     if (meetingsError) {
       console.error("Error fetching meetings:", meetingsError);
       return new Response(
         JSON.stringify({ error: "Database error" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const formattedMeetings = (meetings || []).map((m: any) => ({
       ...m,
       project: m.projects,
       projects: undefined,
     }));
 
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