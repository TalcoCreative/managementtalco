import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All queryable tables in Talco Management System
const ALLOWED_TABLES = [
  "profiles", "user_roles", "user_dynamic_roles", "dynamic_roles", "role_permissions",
  "clients", "client_accounts", "client_activity_logs", "client_contracts", "client_documents",
  "client_payment_settings", "client_payments", "client_quotas",
  "projects", "tasks", "task_status_logs", "comments", "comment_mentions",
  "attendance", "auto_clockout_notifications",
  "leave_requests",
  "income", "expenses", "ledger_entries", "recurring_entries",
  "balance_sheet_items", "chart_of_accounts", "company_settings",
  "events", "event_crew", "event_checklists", "event_documents", "event_history", "event_issues", "event_vendors",
  "shooting_schedules",
  "meetings", "meeting_participants", "meeting_invitations",
  "assets", "asset_transactions",
  "candidates", "candidate_assessments", "candidate_notes", "candidate_notifications", "candidate_status_history",
  "recruitment_forms", "form_questions", "form_responses", "form_answers",
  "prospects", "prospect_history",
  "kol_profiles", "kol_campaigns", "kol_campaign_history",
  "editorial_plans", "editorial_slides", "ep_comments", "ep_activity_logs",
  "announcements", "announcement_reads",
  "letters",
  "disciplinary_cases",
  "holidays",
  "social_media_accounts",
  "email_logs", "email_settings",
  "deletion_logs",
  "payroll_records",
  "reimbursements",
  "marketplace_reports",
];

// Tool definitions for the AI to call
const DATA_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_table",
      description: `Query any table in the Talco Management System. Available tables: ${ALLOWED_TABLES.join(", ")}. You can filter, sort, limit, and select specific columns. Use this to retrieve raw data for analysis. You may call this multiple times for different tables or different filters.`,
      parameters: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "The table name to query.",
          },
          select: {
            type: "string",
            description: "Columns to select. Use '*' for all columns. Supports Supabase select syntax with joins, e.g. '*, clients(name), profiles!assigned_to(full_name)'. Default: '*'",
          },
          filters: {
            type: "array",
            description: "Array of filter conditions to apply.",
            items: {
              type: "object",
              properties: {
                column: { type: "string", description: "Column name to filter on." },
                operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"], description: "Filter operator." },
                value: { type: "string", description: "Filter value. For 'in' operator, comma-separated values. For 'is', use 'null' or 'not.null'." },
              },
              required: ["column", "operator", "value"],
            },
          },
          order_by: {
            type: "string",
            description: "Column to order by. Prefix with '-' for descending. e.g. '-created_at' for newest first.",
          },
          limit: {
            type: "number",
            description: "Max rows to return. Default: 100. Max: 500.",
          },
          count_only: {
            type: "boolean",
            description: "If true, only return the count of matching rows, not the data itself.",
          },
        },
        required: ["table"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_overview",
      description: "Get a quick overview of the entire system: counts of all major entities (clients, projects, tasks, employees, events, etc.), today's attendance, and recent activity summary. Use this as a starting point for broad questions.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

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

    const systemPrompt = `You are Tassa (Talco Support Assistant), an intelligent internal strategic assistant for Super Admin of Talco Management System.

You have FULL ACCESS to the entire Talco Management System database through tool calls. You can query ANY table, filter, join, and analyze data across all modules.

MODULES YOU HAVE ACCESS TO:
- Dashboard, Clients, Projects, Tasks, Schedule
- Shooting, Meeting, Leave, Reimburse, Asset, Event
- Reports, Form Builder, KOL Database, KOL Campaign
- Surat (Letters), Social Media, Editorial Plan, Content Builder
- HR: Team, HR Dashboard, HR Analytics, Kalender Libur, Performance, Recruitment
- Finance: Income, Expenses, Laba Rugi, Neraca
- Sales: Analytics, Prospects
- Executive: CEO Dashboard
- System: Email Settings, Role & Access, System Settings

KEY TABLES AND RELATIONSHIPS:
- profiles: all employees (id, full_name, division, position, employment_status, phone, join_date)
- tasks: linked to profiles via assigned_to, to projects via project_id, to clients via client_id
- projects: linked to clients via client_id, has tasks
- clients: has projects, contracts, payments, quotas, accounts, documents
- attendance: linked to profiles via user_id, daily clock in/out records
- leave_requests: employee leave data
- income/expenses: financial records with categories
- events: with crew, checklists, vendors, documents
- shooting_schedules: photo/video production schedules
- meetings/meeting_participants: meeting records
- prospects/prospect_history: sales pipeline
- candidates: recruitment pipeline with status tracking
- kol_profiles/kol_campaigns: influencer management
- editorial_plans/editorial_slides: content planning (editorial_slides has created_by for who made the slide)
- assets/asset_transactions: company asset tracking
- disciplinary_cases: HR disciplinary records
- announcements: company announcements
- letters: official company letters
- holidays: company holiday calendar
- marketplace_reports: Tokopedia & Shopee marketplace data
- reimbursements: employee reimbursement records
- payroll_records: employee payroll data

INVESTIGATION WORKFLOW (MANDATORY):
1. Understand what the user is asking
2. Identify which tables contain the relevant data
3. ALWAYS use query_table or get_system_overview tool to fetch the data BEFORE answering
4. Analyze ONLY the returned data
5. Answer clearly with specific numbers and facts FROM the data

CRITICAL RULE — NO DATA FABRICATION:
- You must NEVER invent, assume, or fabricate ANY data whatsoever
- If the required dataset has NOT been returned by a tool call, you MUST call the tool first
- If a tool returns empty data, say clearly: "Gue udah cek sistemnya tapi ga ada data yang cocok buat request ini."
- If you are unsure which table or field to query, say so and ask the user for clarification
- FORBIDDEN: inventing employee names, tasks, due dates, projects, schedules, amounts, or any other data
- FORBIDDEN: guessing database fields or table structures — use only ALLOWED_TABLES
- NO DATASET = NO ANSWER. You must always fetch data first.
- Every single number, name, date, or fact in your response MUST come from a tool call result

STRICT DATA DEPENDENCY:
- You answer ONLY based on returned datasets from tool calls
- If no dataset is returned yet, you MUST call a tool — never skip this step
- If a tool call fails or returns an error, report the error honestly
- Cross-reference data across tables when needed (e.g., get task data, then look up employee names from profiles)
- You can call multiple query_table tools in parallel for efficiency

PERSONALITY:
- Friendly, casual, approachable - like a smart colleague
- Direct and concise, no fluff
- Strategic and observant
- Speak naturally in Bahasa Indonesia
- No emojis, no excessive corporate jargon
- No robotic tone

RESPONSE FORMAT (flexible, use what fits):
Start with a natural direct answer, then if helpful:
- **Yang Gue Lihat:** key facts, numbers, patterns from the data
- **Yang Perlu Diperhatiin:** risks or issues (if any)
- **Saran Gue:** actionable next steps (if relevant)

Keep it conversational. Not every answer needs all sections.`;

    // STEP 1: Call AI with tools to let it decide what data to fetch
    const step1Response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools: DATA_TOOLS,
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!step1Response.ok) {
      const status = step1Response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, coba lagi sebentar ya." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits habis. Top up di workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await step1Response.text();
      console.error("AI gateway step1 error:", status, errText);
      return new Response(JSON.stringify({ error: `AI gateway error: ${status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const step1Data = await step1Response.json();
    const assistantMessage = step1Data.choices?.[0]?.message;

    // If the AI didn't call any tools, it has enough context - stream the response directly
    if (!assistantMessage?.tool_calls || assistantMessage.tool_calls.length === 0) {
      // Re-call with streaming for the final answer
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        return new Response(JSON.stringify({ error: "AI streaming error" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // STEP 2: Execute all tool calls in parallel
    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (toolCall: any) => {
        const funcName = toolCall.function.name;
        let args: any;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          return { tool_call_id: toolCall.id, role: "tool", content: JSON.stringify({ error: "Invalid arguments" }) };
        }

        try {
          let result: any;
          if (funcName === "get_system_overview") {
            result = await getSystemOverview(adminClient);
          } else if (funcName === "query_table") {
            result = await queryTable(adminClient, args);
          } else {
            result = { error: "Unknown function" };
          }
          // Truncate if too large
          let content = JSON.stringify(result);
          if (content.length > 60000) {
            content = content.slice(0, 60000) + "... [TRUNCATED - too much data, try narrower filters or smaller limit]";
          }
          return { tool_call_id: toolCall.id, role: "tool", content };
        } catch (e) {
          console.error(`Tool ${funcName} error:`, e);
          return { tool_call_id: toolCall.id, role: "tool", content: JSON.stringify({ error: String(e) }) };
        }
      })
    );

    // STEP 3: Send tool results back and stream the final response
    const step3Messages = [
      { role: "system", content: systemPrompt },
      ...messages,
      assistantMessage,
      ...toolResults,
    ];

    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: step3Messages,
        stream: true,
      }),
    });

    if (!finalResponse.ok) {
      const errText = await finalResponse.text();
      console.error("AI gateway final error:", finalResponse.status, errText);
      return new Response(JSON.stringify({ error: `AI gateway error: ${finalResponse.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(finalResponse.body, {
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

// ─── Tool Implementations ────────────────────────────────────────────────────

async function getSystemOverview(client: any): Promise<any> {
  const tables = [
    "clients", "projects", "tasks", "events", "profiles",
    "prospects", "candidates", "meetings", "shooting_schedules",
    "assets", "leave_requests", "income", "expenses",
    "editorial_plans", "kol_profiles", "kol_campaigns",
    "announcements", "letters", "disciplinary_cases",
  ];

  const counts: Record<string, number> = {};
  await Promise.all(
    tables.map(async (table) => {
      try {
        const { count } = await client.from(table).select("*", { count: "exact", head: true });
        counts[table] = count || 0;
      } catch {
        counts[table] = -1; // table may not exist
      }
    })
  );

  // Today's attendance
  const today = new Date().toISOString().split("T")[0];
  let attendanceSummary: any = {};
  try {
    const { data: att } = await client.from("attendance").select("clock_in, clock_out").eq("date", today);
    attendanceSummary = {
      total: att?.length || 0,
      clocked_in: att?.filter((a: any) => a.clock_in && !a.clock_out).length || 0,
      completed: att?.filter((a: any) => a.clock_in && a.clock_out).length || 0,
    };
  } catch { /* ignore */ }

  // Recent finance
  let financeSummary: any = {};
  try {
    const thisMonth = new Date();
    const monthStart = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: inc } = await client.from("income").select("amount").gte("created_at", monthStart);
    const { data: exp } = await client.from("expenses").select("amount").gte("created_at", monthStart);
    const totalInc = inc?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0;
    const totalExp = exp?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0;
    financeSummary = { this_month_income: totalInc, this_month_expenses: totalExp, net: totalInc - totalExp };
  } catch { /* ignore */ }

  // Task status breakdown
  let taskSummary: any = {};
  try {
    const { data: tasks } = await client.from("tasks").select("status");
    if (tasks) {
      taskSummary = {};
      tasks.forEach((t: any) => {
        const s = t.status || "unknown";
        taskSummary[s] = (taskSummary[s] || 0) + 1;
      });
    }
  } catch { /* ignore */ }

  return {
    entity_counts: counts,
    today_attendance: attendanceSummary,
    this_month_finance: financeSummary,
    task_status_breakdown: taskSummary,
    date: today,
  };
}

async function queryTable(client: any, args: any): Promise<any> {
  const { table, select = "*", filters = [], order_by, limit = 100, count_only = false } = args;

  if (!ALLOWED_TABLES.includes(table)) {
    return { error: `Table '${table}' is not available. Available tables: ${ALLOWED_TABLES.join(", ")}` };
  }

  const safeLimit = Math.min(Math.max(1, limit), 500);

  try {
    if (count_only) {
      let query = client.from(table).select("*", { count: "exact", head: true });
      query = applyFilters(query, filters);
      const { count, error } = await query;
      if (error) return { error: error.message };
      return { table, count, filters_applied: filters };
    }

    let query = client.from(table).select(select);
    query = applyFilters(query, filters);

    if (order_by) {
      const desc = order_by.startsWith("-");
      const col = desc ? order_by.slice(1) : order_by;
      query = query.order(col, { ascending: !desc });
    }

    query = query.limit(safeLimit);
    const { data, error, count } = await query;
    if (error) return { error: error.message };

    return {
      table,
      row_count: data?.length || 0,
      data,
    };
  } catch (e) {
    return { error: String(e) };
  }
}

function applyFilters(query: any, filters: any[]): any {
  for (const f of filters) {
    const { column, operator, value } = f;
    switch (operator) {
      case "eq": query = query.eq(column, value); break;
      case "neq": query = query.neq(column, value); break;
      case "gt": query = query.gt(column, value); break;
      case "gte": query = query.gte(column, value); break;
      case "lt": query = query.lt(column, value); break;
      case "lte": query = query.lte(column, value); break;
      case "like": query = query.like(column, value); break;
      case "ilike": query = query.ilike(column, value); break;
      case "in": query = query.in(column, value.split(",")); break;
      case "is":
        if (value === "null") query = query.is(column, null);
        else if (value === "not.null") query = query.not(column, "is", null);
        break;
    }
  }
  return query;
}
