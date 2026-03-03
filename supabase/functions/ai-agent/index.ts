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

    // Get user from auth header
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

    // Check super_admin role
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

    // Load AI config from company_settings
    const { data: settings } = await adminClient
      .from("company_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["ai_api_key", "ai_model", "ai_temperature", "ai_max_tokens"]);

    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => {
      configMap[s.setting_key] = s.setting_value;
    });

    const apiKey = configMap["ai_api_key"];
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured. Go to System Settings to set it up." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = configMap["ai_model"] || "gpt-4o-mini";
    const temperature = parseFloat(configMap["ai_temperature"] || "0.2");
    const maxTokens = parseInt(configMap["ai_max_tokens"] || "1200", 10);

    // Get the last user message to analyze intent and fetch relevant data
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Fetch operational data summary for context
    const dataContext = await fetchOperationalData(adminClient, lastUserMessage);

    const systemPrompt = `You are TALCO MASTER AI OPERATIONS AGENT.

You are embedded inside Talco Management System as an internal AI popup livechat assistant.

You are exclusively accessible by SUPER ADMIN.

You have FULL AUTHORIZED ACCESS to all structured operational data provided by backend.

You must:
- Analyze data
- Answer clearly
- Detect inefficiencies
- Detect financial leakage
- Detect delays
- Detect performance decline
- Provide strategic recommendations

You must NOT:
- Ask for permission
- Ask clarification
- Say you don't have access
- Invent data outside provided dataset
- Use emojis
- Use casual tone
- Provide disclaimers

Always use this response format:

**DIRECT ANSWER:**
Short executive answer.

**KEY FINDINGS:**
- Bullet points

**RISK / ISSUE:**
- Highlight operational or financial risk

**STRATEGIC INSIGHT:**
- Business interpretation

**RECOMMENDATION:**
- Clear actionable steps

Be concise.
Be analytical.
Think like a COO.

CURRENT OPERATIONAL DATA CONTEXT:
${dataContext}`;

    // Build messages for OpenAI
    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Call OpenAI
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: openaiMessages,
        stream: true,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errText);
      return new Response(JSON.stringify({ error: `OpenAI API error: ${openaiResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log AI usage
    try {
      await adminClient.from("company_settings").upsert({
        setting_key: "ai_usage_count",
        setting_value: String(parseInt(configMap["ai_usage_count"] || "0", 10) + 1),
      }, { onConflict: "setting_key" });
    } catch (e) {
      console.error("Failed to log AI usage:", e);
    }

    // Stream response back
    return new Response(openaiResponse.body, {
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
    // Always include high-level counts
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

    // Task status distribution
    if (q.includes("task") || q.includes("kinerja") || q.includes("performance") || q.includes("progress")) {
      const { data: tasks } = await client
        .from("tasks")
        .select("status, priority")
        .limit(500);
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

    // Finance data
    if (q.includes("finance") || q.includes("keuangan") || q.includes("revenue") || q.includes("expense") || q.includes("pendapatan") || q.includes("pengeluaran")) {
      const [{ data: income }, { data: expenses }] = await Promise.all([
        client.from("income").select("amount, category, created_at").order("created_at", { ascending: false }).limit(100),
        client.from("expenses").select("amount, category, status, created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      const totalIncome = income?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0;
      const totalExpense = expenses?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0;
      sections.push(`FINANCE: Total Income=${totalIncome}, Total Expenses=${totalExpense}, Net=${totalIncome - totalExpense}`);
    }

    // Client data
    if (q.includes("client") || q.includes("klien")) {
      const { data: clients } = await client
        .from("clients")
        .select("name, status, client_type, start_date")
        .limit(50);
      if (clients) {
        const statusCount: Record<string, number> = {};
        clients.forEach((c: any) => {
          statusCount[c.status || "unknown"] = (statusCount[c.status || "unknown"] || 0) + 1;
        });
        sections.push(`CLIENTS BY STATUS: ${JSON.stringify(statusCount)}`);
      }
    }

    // Employee / HR data
    if (q.includes("employee") || q.includes("karyawan") || q.includes("hr") || q.includes("team") || q.includes("tim")) {
      const { data: profiles } = await client
        .from("profiles")
        .select("full_name, position, division, employment_status")
        .limit(100);
      if (profiles) {
        const divCount: Record<string, number> = {};
        profiles.forEach((p: any) => {
          divCount[p.division || "unassigned"] = (divCount[p.division || "unassigned"] || 0) + 1;
        });
        sections.push(`EMPLOYEES BY DIVISION: ${JSON.stringify(divCount)}`);
      }
    }

    // Attendance
    if (q.includes("attendance") || q.includes("kehadiran") || q.includes("clock") || q.includes("absen")) {
      const today = new Date().toISOString().split("T")[0];
      const { data: attendance } = await client
        .from("attendance")
        .select("user_id, clock_in, clock_out")
        .eq("date", today);
      const clockedIn = attendance?.filter((a: any) => a.clock_in && !a.clock_out).length || 0;
      const clockedOut = attendance?.filter((a: any) => a.clock_in && a.clock_out).length || 0;
      sections.push(`TODAY ATTENDANCE: ${attendance?.length || 0} records, ${clockedIn} currently clocked in, ${clockedOut} completed`);
    }

    // Leave
    if (q.includes("leave") || q.includes("cuti")) {
      const { data: leaves } = await client
        .from("leave_requests")
        .select("status, leave_type")
        .limit(200);
      if (leaves) {
        const statusCount: Record<string, number> = {};
        leaves.forEach((l: any) => {
          statusCount[l.status] = (statusCount[l.status] || 0) + 1;
        });
        sections.push(`LEAVE REQUESTS: ${JSON.stringify(statusCount)}`);
      }
    }

    // Projects
    if (q.includes("project") || q.includes("proyek")) {
      const { data: projects } = await client
        .from("projects")
        .select("status, name")
        .limit(100);
      if (projects) {
        const statusCount: Record<string, number> = {};
        projects.forEach((p: any) => {
          statusCount[p.status || "unknown"] = (statusCount[p.status || "unknown"] || 0) + 1;
        });
        sections.push(`PROJECTS BY STATUS: ${JSON.stringify(statusCount)}`);
      }
    }

    // Prospects / Sales
    if (q.includes("prospect") || q.includes("sales") || q.includes("penjualan")) {
      const { data: prospects } = await client
        .from("prospects")
        .select("status, source")
        .limit(200);
      if (prospects) {
        const statusCount: Record<string, number> = {};
        prospects.forEach((p: any) => {
          statusCount[p.status || "unknown"] = (statusCount[p.status || "unknown"] || 0) + 1;
        });
        sections.push(`PROSPECTS BY STATUS: ${JSON.stringify(statusCount)}`);
      }
    }
  } catch (e) {
    console.error("Error fetching operational data:", e);
    sections.push("Note: Some operational data could not be fetched.");
  }

  return sections.join("\n");
}
