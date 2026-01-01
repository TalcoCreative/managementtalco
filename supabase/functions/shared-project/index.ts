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

    console.log("Shared project request with token:", token);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase configuration");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project by share_token
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        description,
        status,
        deadline,
        created_at,
        type,
        clients(name),
        profiles:assigned_to(full_name)
      `)
      .eq("share_token", token)
      .maybeSingle();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      return json({ error: "Failed to fetch project" }, 500);
    }

    if (!project) {
      console.log("Project not found for token:", token);
      return json({ error: "Project not found" }, 404);
    }

    console.log("Found project:", project.id);

    // Fetch tasks for this project
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        status,
        deadline,
        priority,
        profiles:profiles!fk_tasks_assigned_to_profiles(full_name)
      `)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
    }

    // Extract unique team members from tasks
    const teamMembers = new Set<string>();
    tasks?.forEach((task: any) => {
      if (task.profiles?.full_name) {
        teamMembers.add(task.profiles.full_name);
      }
    });

    // Add project lead
    const projectLead = (project as any).profiles;
    if (projectLead?.full_name) {
      teamMembers.add(projectLead.full_name);
    }

    return json({
      project,
      tasks: tasks || [],
      team: Array.from(teamMembers),
    });
  } catch (error) {
    console.error("Error in shared-project function:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
