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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let slug: string | null = null;
    let startDate: string | null = null;
    let endDate: string | null = null;
    let statusFilter: string | null = null;
    let sortBy: string = "deadline";

    const url = new URL(req.url);
    slug = url.searchParams.get("slug");
    startDate = url.searchParams.get("startDate");
    endDate = url.searchParams.get("endDate");
    statusFilter = url.searchParams.get("status");
    sortBy = url.searchParams.get("sortBy") || "deadline";

    if (!slug) {
      return json({ error: "Slug is required" }, 400);
    }

    console.log("Client dashboard request with slug:", slug);

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
      .select("id, name, company, status")
      .eq("dashboard_slug", slug)
      .maybeSingle();

    if (clientError) {
      console.error("Error fetching client:", clientError);
      return json({ error: "Failed to fetch client" }, 500);
    }

    if (!client) {
      console.log("Client not found for slug:", slug);
      return json({ error: "Client not found" }, 404);
    }

    console.log("Found client:", client.id);

    // Fetch projects for this client
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        status,
        deadline,
        created_at
      `)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      return json({ error: "Failed to fetch projects" }, 500);
    }

    const projectIds = projects?.map(p => p.id) || [];

    // Fetch tasks for these projects
    let tasksQuery = supabase
      .from("tasks")
      .select(`
        id,
        title,
        status,
        deadline,
        priority,
        project_id,
        created_at
      `)
      .in("project_id", projectIds.length > 0 ? projectIds : ['no-project']);

    // Apply date filter
    if (startDate) {
      tasksQuery = tasksQuery.gte("deadline", startDate);
    }
    if (endDate) {
      tasksQuery = tasksQuery.lte("deadline", endDate);
    }

    // Apply status filter
    if (statusFilter && statusFilter !== "all") {
      tasksQuery = tasksQuery.eq("status", statusFilter);
    }

    // Apply sorting
    if (sortBy === "deadline") {
      tasksQuery = tasksQuery.order("deadline", { ascending: true, nullsFirst: false });
    } else if (sortBy === "status") {
      tasksQuery = tasksQuery.order("status", { ascending: true });
    }

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      return json({ error: "Failed to fetch tasks" }, 500);
    }

    // Calculate analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalProjects = projects?.length || 0;
    const completedProjects = projects?.filter(p => p.status === "completed").length || 0;
    const inProgressProjects = projects?.filter(p => p.status === "in_progress").length || 0;
    const delayedProjects = projects?.filter(p => {
      if (!p.deadline) return false;
      const deadline = new Date(p.deadline);
      return deadline < today && p.status !== "completed";
    }).length || 0;

    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.status === "completed").length || 0;
    const inProgressTasks = tasks?.filter(t => t.status === "in_progress").length || 0;
    const pendingTasks = tasks?.filter(t => t.status === "pending").length || 0;

    const overdueTasks = tasks?.filter(t => {
      if (!t.deadline || t.status === "completed") return false;
      const deadline = new Date(t.deadline);
      return deadline < today;
    }).length || 0;

    const upcomingDeadlines = tasks?.filter(t => {
      if (!t.deadline || t.status === "completed") return false;
      const deadline = new Date(t.deadline);
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      return deadline >= today && deadline <= threeDaysFromNow;
    }).length || 0;

    // Group tasks by project
    const tasksByProject: Record<string, typeof tasks> = {};
    tasks?.forEach(task => {
      if (!tasksByProject[task.project_id]) {
        tasksByProject[task.project_id] = [];
      }
      tasksByProject[task.project_id].push(task);
    });

    // Enrich projects with task counts
    const enrichedProjects = projects?.map(project => ({
      ...project,
      totalTasks: tasksByProject[project.id]?.length || 0,
      completedTasks: tasksByProject[project.id]?.filter(t => t.status === "completed").length || 0,
      isDelayed: project.deadline && new Date(project.deadline) < today && project.status !== "completed",
    }));

    return json({
      client: {
        name: client.name,
        company: client.company,
      },
      projects: enrichedProjects || [],
      tasks: tasks || [],
      analytics: {
        totalProjects,
        completedProjects,
        inProgressProjects,
        delayedProjects,
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        overdueTasks,
        upcomingDeadlines,
      },
    });
  } catch (error) {
    console.error("Error in shared-client-dashboard function:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
