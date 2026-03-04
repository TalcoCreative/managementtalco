import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isSuperAdmin = roles?.some((r: any) => r.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid request: messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI Gateway not configured." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const dataContext = await fetchOperationalData(adminClient, lastUserMessage);

    const systemPrompt = `You are Tassa (Talco Support Assistant).

You operate inside Talco Management System.

You are only accessible by SUPER ADMIN.

You analyze structured operational data provided by backend from modules including:
Clients, Projects, Tasks, Schedule, HR, Performance, Finance, Sales, KOL Campaign, Social Media, Executive Dashboard, and other Talco system modules.

You do NOT directly access database.
You only analyze structured data provided in each request.

PERSONALITY:
You are smart, sharp, and observant.
You speak in a natural, relaxed, professional tone.
You are not robotic.
You are not overly formal.
You are confident but friendly.
You are Talco's internal strategic partner, not a cold corporate report generator.

MISSION:
- Answer questions clearly.
- Explain findings in simple language.
- Highlight risks naturally.
- Give useful insight.
- Give practical suggestions.
- Connect patterns across departments when relevant.

RULES:
- Do not ask for permission.
- Do not say you don't have access.
- Do not invent missing data.
- If data is not provided, say clearly that specific data was not included.
- Do not use emojis.
- Do not sound stiff.
- Do not repeat the question.
- Do not use corporate jargon excessively.

RESPONSE STYLE:
Start naturally, like you're responding in a real internal chat.
Then structure the response like this:

**Jawaban Singkat:**
Explain directly in conversational tone.

**Yang Gue Lihat:**
- Bullet points
- Important numbers or facts

**Yang Perlu Diperhatiin:**
Explain risks casually but clearly.

**Insight:**
Connect the dots.

**Saran Gue:**
Clear actionable suggestions.

Think like a strategic team member who really understands Talco's operations.

CURRENT OPERATIONAL DATA CONTEXT:
${dataContext}`;

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: openaiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchOperationalData(client: any, question: string): Promise<string> {
  const sections: string[] = [];
  const q = question.toLowerCase();

  try {
    const [
      { count: clientCount },
      { count: projectCount },
      { count: taskCount },
      { count: eventCount },
      { count: employeeCount },
    ] = await Promise.all([
      client.from("clients").select("*", { count: "exact", head: true }),
      client.from("projects").select("*", { count: "exact", head: true }),
      client.from("tasks").select("*", { count: "exact", head: true }),
      client.from("events").select("*", { count: "exact", head: true }),
      client.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    sections.push(`OVERVIEW: ${clientCount} clients, ${projectCount} projects, ${taskCount} tasks, ${eventCount} events, ${employeeCount} employees`);

    if (q.includes("task") || q.includes("kinerja") || q.includes("performance") || q.includes("progress")) {
      const { data: tasks } = await client.from("tasks").select("status, priority").limit(500);
      if (tasks) {
        const statusCount: Record<string, number> = {};
        const prioCount: Record<string, number> = {};
        tasks.forEach((t: any) => {
          statusCount[t.status] = (statusCount[t.status] || 0) + 1;
          prioCount[t.priority] = (prioCount[t.priority] || 0) + 1;
        });
        sections.push(`TASKS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`TASKS BY PRIORITY: ${JSON.stringify(prioCount)}`);
      }
    }

    if (q.includes("finance") || q.includes("keuangan") || q.includes("revenue") || q.includes("expense") || q.includes("pendapatan") || q.includes("pengeluaran")) {
      const [{ data: income }, { data: expenses }] = await Promise.all([
        client.from("income").select("amount, category, created_at").order("created_at", { ascending: false }).limit(100),
        client.from("expenses").select("amount, category, status, created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      const totalIncome = income?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0;
      const totalExpense = expenses?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0;
      sections.push(`FINANCE: Total Income=${totalIncome}, Total Expenses=${totalExpense}, Net=${totalIncome - totalExpense}`);
    }

    if (q.includes("client") || q.includes("klien")) {
      const { data: clients } = await client.from("clients").select("name, status, client_type, start_date").limit(50);
      if (clients) {
        const statusCount: Record<string, number> = {};
        clients.forEach((c: any) => { statusCount[c.status || "unknown"] = (statusCount[c.status || "unknown"] || 0) + 1; });
        sections.push(`CLIENTS BY STATUS: ${JSON.stringify(statusCount)}`);
      }
    }

    if (q.includes("employee") || q.includes("karyawan") || q.includes("hr") || q.includes("team") || q.includes("tim")) {
      const { data: profiles } = await client.from("profiles").select("full_name, position, division, employment_status").limit(100);
      if (profiles) {
        const divCount: Record<string, number> = {};
        profiles.forEach((p: any) => { divCount[p.division || "unassigned"] = (divCount[p.division || "unassigned"] || 0) + 1; });
        sections.push(`EMPLOYEES BY DIVISION: ${JSON.stringify(divCount)}`);
      }
    }

    if (q.includes("attendance") || q.includes("kehadiran") || q.includes("clock") || q.includes("absen")) {
      const today = new Date().toISOString().split("T")[0];
      const { data: attendance } = await client.from("attendance").select("user_id, clock_in, clock_out").eq("date", today);
      const clockedIn = attendance?.filter((a: any) => a.clock_in && !a.clock_out).length || 0;
      const clockedOut = attendance?.filter((a: any) => a.clock_in && a.clock_out).length || 0;
      sections.push(`TODAY ATTENDANCE: ${attendance?.length || 0} records, ${clockedIn} currently clocked in, ${clockedOut} completed`);
    }

    if (q.includes("leave") || q.includes("cuti")) {
      const { data: leaves } = await client.from("leave_requests").select("status, leave_type").limit(200);
      if (leaves) {
        const statusCount: Record<string, number> = {};
        leaves.forEach((l: any) => { statusCount[l.status] = (statusCount[l.status] || 0) + 1; });
        sections.push(`LEAVE REQUESTS: ${JSON.stringify(statusCount)}`);
      }
    }

    if (q.includes("project") || q.includes("proyek")) {
      const { data: projects } = await client.from("projects").select("status, name").limit(100);
      if (projects) {
        const statusCount: Record<string, number> = {};
        projects.forEach((p: any) => { statusCount[p.status || "unknown"] = (statusCount[p.status || "unknown"] || 0) + 1; });
        sections.push(`PROJECTS BY STATUS: ${JSON.stringify(statusCount)}`);
      }
    }

    if (q.includes("prospect") || q.includes("sales") || q.includes("penjualan")) {
      const { data: prospects } = await client.from("prospects").select("status, source").limit(200);
      if (prospects) {
        const statusCount: Record<string, number> = {};
        prospects.forEach((p: any) => { statusCount[p.status || "unknown"] = (statusCount[p.status || "unknown"] || 0) + 1; });
        sections.push(`PROSPECTS BY STATUS: ${JSON.stringify(statusCount)}`);
      }
    }
  } catch (e) {
    console.error("Error fetching operational data:", e);
    sections.push("Note: Some operational data could not be fetched.");
  }

  return sections.join("\n");
}
