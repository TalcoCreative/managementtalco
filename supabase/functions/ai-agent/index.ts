import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── ALL queryable tables (full crawl access for TASSA) ──────────────────────
const ALLOWED_TABLES = [
  // Identity & Access
  "profiles", "user_roles", "user_dynamic_roles", "dynamic_roles", "role_permissions", "positions",
  // Clients & Projects
  "clients", "client_accounts", "client_activity_logs", "client_contracts", "client_documents",
  "client_payment_settings", "client_payments", "client_quotas",
  "projects", "products",
  // Tasks
  "tasks", "sub_tasks", "task_activities", "task_assignees", "task_attachments",
  "task_notifications", "task_public_comments", "task_status_logs", "task_watchers",
  "comments", "comment_mentions",
  // HR
  "attendance", "auto_clockout_notifications", "leave_requests", "reimbursements",
  "payroll", "freelancers", "disciplinary_cases", "holidays",
  // Operations
  "events", "event_crew", "event_checklists", "event_documents", "event_history",
  "event_issues", "event_vendors",
  "shooting_schedules", "shooting_crew", "shooting_notifications", "shooting_tasks",
  "meetings", "meeting_participants", "meeting_external_participants",
  "meeting_invitations", "meeting_minutes", "meeting_notifications",
  "assets", "asset_transactions",
  // Recruitment
  "candidates", "candidate_assessments", "candidate_notes",
  "candidate_notifications", "candidate_status_history",
  "recruitment_forms", "recruitment_form_fields", "recruitment_form_submissions",
  "forms", "form_questions", "form_responses", "form_answers",
  // Sales
  "prospects", "prospect_activity_logs", "prospect_comments", "prospect_status_history",
  "commissions", "commission_rules", "commission_settings",
  // Ads
  "ads_budgets", "ads_budget_transactions", "monthly_ads_reports", "master_wallet_transactions",
  // Finance
  "income", "expenses", "ledger_entries", "ledger_account_mappings",
  "recurring_budget", "balance_sheet_items", "chart_of_accounts",
  "invoices", "invoice_templates", "invoice_activity_logs", "withdrawals",
  // Marketing & Content
  "social_media_accounts", "social_media_posts", "social_media_analytics",
  "social_media_settings", "socialbu_accounts", "scheduled_posts",
  "editorial_plans", "editorial_slides", "slide_blocks",
  "ep_comments", "ep_activity_logs",
  "kol_database", "kol_campaigns", "kol_campaign_history",
  "marketplace_reports", "monthly_organic_reports", "platform_accounts",
  // Letters & Announcements
  "letters", "letter_activity_logs", "announcements", "announcement_reads",
  // System
  "company_settings", "office_locations", "email_logs", "email_settings", "email_templates",
  "notification_logs", "push_notification_logs", "push_subscriptions",
  "wa_groups", "wa_notification_settings", "report_audit_logs", "deletion_logs",
  "personal_notes",
];

// Tables exposed for action (CRUD via TASSA). Excludes audit/system/security tables.
const ACTIONABLE_TABLES: Record<string, { create: boolean; update: boolean; delete: boolean }> = {
  clients: { create: true, update: true, delete: true },
  projects: { create: true, update: true, delete: true },
  tasks: { create: true, update: true, delete: true },
  sub_tasks: { create: true, update: true, delete: true },
  meetings: { create: true, update: true, delete: true },
  shooting_schedules: { create: true, update: true, delete: true },
  events: { create: true, update: true, delete: true },
  prospects: { create: true, update: true, delete: true },
  commission_rules: { create: true, update: true, delete: true },
  commissions: { create: false, update: true, delete: false },
  ads_budgets: { create: true, update: true, delete: false },
  ads_budget_transactions: { create: true, update: true, delete: true },
  income: { create: true, update: true, delete: true },
  expenses: { create: true, update: true, delete: true },
  ledger_entries: { create: true, update: true, delete: true },
  invoices: { create: true, update: true, delete: true },
  reimbursements: { create: true, update: true, delete: false },
  leave_requests: { create: true, update: true, delete: false },
  letters: { create: true, update: true, delete: true },
  announcements: { create: true, update: true, delete: true },
  editorial_plans: { create: true, update: true, delete: true },
  editorial_slides: { create: true, update: true, delete: true },
  kol_database: { create: true, update: true, delete: true },
  kol_campaigns: { create: true, update: true, delete: true },
  assets: { create: true, update: true, delete: true },
  candidates: { create: true, update: true, delete: false },
  holidays: { create: true, update: true, delete: true },
  disciplinary_cases: { create: true, update: true, delete: false },
  products: { create: true, update: true, delete: true },
  personal_notes: { create: true, update: true, delete: true },
};

// ─── Tool definitions ────────────────────────────────────────────────────────
const DATA_TOOLS = [
  {
    type: "function",
    function: {
      name: "query_table",
      description: `Query any table in the Talco Management System. Available tables: ${ALLOWED_TABLES.join(", ")}. Use this to retrieve raw data for analysis.`,
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          select: { type: "string", description: "Columns. Default '*'. Supports joins like '*, clients(name)'." },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"] },
                value: { type: "string" },
              },
              required: ["column", "operator", "value"],
            },
          },
          order_by: { type: "string", description: "Prefix '-' for descending." },
          limit: { type: "number", description: "Max 500. Default 100." },
          count_only: { type: "boolean" },
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
      description: "Quick overview of all major entities, today's attendance, this month's finance, recent activity. Use as starting point for broad questions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_finance_dashboard",
      description: "Real-time Finance Dashboard data: saldo, income/expenses, payroll vs non-payroll, expense by category, monthly trend, forecast.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number" },
          month: { type: "number", description: "0-11. Omit for all months." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_smart_alerts",
      description: "Auto-detect anomalies & risks across the business: sales drop, ads overspend vs budget, overdue tasks, cashflow risk, late employees, candidates pending too long. Returns prioritized alert list.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_brief",
      description: "Get today's daily executive brief: revenue today/MTD, task status, problems, opportunities, key meetings/shootings today.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_action",
      description: `Propose a CREATE/UPDATE/DELETE action on a table. This DOES NOT execute. It returns a draft for the user to confirm. The frontend will render a confirmation card. Only call this AFTER the user expresses intent to input/edit/delete data. Allowed tables: ${Object.keys(ACTIONABLE_TABLES).join(", ")}.`,
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete"] },
          table: { type: "string" },
          record_id: { type: "string", description: "Required for update/delete." },
          payload: {
            type: "object",
            description: "Field values for create/update. Empty for delete.",
            additionalProperties: true,
          },
          summary: { type: "string", description: "Human-readable description of what this action does." },
          missing_fields: {
            type: "array",
            items: { type: "string" },
            description: "List of important fields that are still empty and might need user input.",
          },
        },
        required: ["action", "table", "summary"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_action",
      description: "Execute a previously proposed action AFTER user has explicitly confirmed it (user typed 'confirm', 'ya', 'oke', 'lanjut', 'execute', etc.). Performs the actual database mutation. For delete, requires double_confirm=true.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "delete"] },
          table: { type: "string" },
          record_id: { type: "string" },
          payload: { type: "object", additionalProperties: true },
          double_confirm: { type: "boolean", description: "Required true for delete." },
        },
        required: ["action", "table"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("Unauthorized", 401);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return jsonError("Unauthorized", 401);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // TASSA Full Access mode: any authenticated user can chat (RBAC override per user spec).
    // We still capture identity for audit logs.
    const userId = user.id;

    const body = await req.json();
    const { messages, mode } = body;

    // System trigger modes (cron daily brief, smart alerts) — no chat, just return data
    if (mode === "daily_brief") {
      const brief = await getDailyBrief(adminClient);
      return jsonOk(brief);
    }
    if (mode === "smart_alerts") {
      const alerts = await getSmartAlerts(adminClient);
      return jsonOk(alerts);
    }

    if (!messages || !Array.isArray(messages)) return jsonError("messages array required", 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonError("AI Gateway not configured.", 400);

    const systemPrompt = buildSystemPrompt();

    // Multi-step tool loop (max 4 iterations)
    let conversation: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    let iter = 0;
    const MAX_ITERATIONS = 4;

    while (iter < MAX_ITERATIONS) {
      iter++;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: conversation,
          tools: DATA_TOOLS,
          tool_choice: "auto",
          stream: false,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) return jsonError("Rate limit. Coba lagi sebentar.", 429);
        if (resp.status === 402) return jsonError("AI credits habis.", 402);
        const t = await resp.text();
        console.error("AI gateway error:", resp.status, t);
        return jsonError(`AI gateway error: ${resp.status}`, 502);
      }

      const data = await resp.json();
      const assistantMsg = data.choices?.[0]?.message;

      // No tool calls → final answer; re-stream for token-by-token UX
      if (!assistantMsg?.tool_calls || assistantMsg.tool_calls.length === 0) {
        const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: conversation,
            stream: true,
          }),
        });
        if (!streamResp.ok) return jsonError("AI streaming error", 502);
        return new Response(streamResp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Execute tool calls
      const toolResults = await Promise.all(
        assistantMsg.tool_calls.map(async (tc: any) => {
          const fn = tc.function.name;
          let args: any;
          try { args = JSON.parse(tc.function.arguments); }
          catch { return { tool_call_id: tc.id, role: "tool", content: JSON.stringify({ error: "Invalid args" }) }; }

          try {
            let result: any;
            if (fn === "get_system_overview") result = await getSystemOverview(adminClient);
            else if (fn === "get_finance_dashboard") result = await getFinanceDashboard(adminClient, args);
            else if (fn === "get_smart_alerts") result = await getSmartAlerts(adminClient);
            else if (fn === "get_daily_brief") result = await getDailyBrief(adminClient);
            else if (fn === "query_table") result = await queryTable(adminClient, args);
            else if (fn === "propose_action") result = proposeAction(args);
            else if (fn === "execute_action") result = await executeAction(adminClient, args, userId);
            else result = { error: "Unknown function" };

            let content = JSON.stringify(result);
            if (content.length > 60000) content = content.slice(0, 60000) + "... [TRUNCATED]";
            return { tool_call_id: tc.id, role: "tool", content };
          } catch (e) {
            console.error(`Tool ${fn} error:`, e);
            return { tool_call_id: tc.id, role: "tool", content: JSON.stringify({ error: String(e) }) };
          }
        })
      );

      conversation = [...conversation, assistantMsg, ...toolResults];
      // Loop again — model may need to make further calls (e.g. propose then execute, or chain queries)
    }

    // Safety fallback if iteration cap hit
    return jsonError("Reached max tool iterations.", 500);
  } catch (e) {
    console.error("ai-agent error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(): string {
  return `You are TASSA — Talco Support Assistant. An internal AI for Talco Management System.

ROLE: Analyst, Operator, and Strategic Advisor. Think like a sharp CEO, not a chatbot.

FULL ACCESS MODE: You have unrestricted read and write access across the entire system.

MODULES YOU OWN:
- Core: Clients, Projects, Tasks, Schedule, Shooting, Meeting, Event
- HR: Employee (profiles), Leave, Reimburse, Performance, Recruitment, Attendance, Disciplinary
- Sales: Prospects, Commission, Ads Budget, Products
- Finance: Income, Expense, Ledger, Invoices, Balance Sheet, Payroll
- Marketing: Social Media, Editorial Plan, KOL Database, KOL Campaign, Marketplace Reports
- Executive: CEO Dashboard data, Smart Alerts, Daily Brief
- System: Letters, Announcements, Holidays, Settings

TOOLS:
- query_table: read any table with filters
- get_system_overview: broad cross-module snapshot
- get_finance_dashboard: full finance breakdown
- get_smart_alerts: auto risk detection (sales drop, ads overspend, overdue, cashflow)
- get_daily_brief: today's executive brief
- propose_action: draft a CREATE/UPDATE/DELETE for user confirmation (DOES NOT EXECUTE)
- execute_action: actually perform the mutation AFTER user confirms

KEY COLUMN NAMES (DO NOT GUESS):
- tasks.title, tasks.deadline, tasks.assigned_to, tasks.status, tasks.project_id
- projects.title, projects.client_id, projects.deadline
- clients.name, clients.company, clients.client_type
- profiles.full_name, profiles.user_id (text email), profiles.id (uuid), profiles.phone
- prospects.title, prospects.value, prospects.status, prospects.owner_id
- expenses/income.amount, .category, .sub_category, .client_id, .project_id
- ledger_entries.type ('income'|'expense'), .amount, .date, .sub_category
- meetings.title, .meeting_date, .meeting_time
- shooting_schedules.title, .scheduled_date, .scheduled_time

INVESTIGATION RULES:
1. ANY data question → CALL A TOOL FIRST. Never answer from memory.
2. No dataset → no answer. Period.
3. Cross-reference across tables when needed (e.g. tasks → profiles for assignee names).
4. If empty result, say so honestly.

ACTION FLOW (CRITICAL):
1. User asks to input/edit/delete → CALL propose_action with full draft
2. Frontend will display draft as a confirmation card
3. User confirms ("confirm", "ya", "oke", "lanjut") → CALL execute_action
4. User wants to revise → CALL propose_action again with updated payload
5. DELETE requires double_confirm=true. Always ask once more before executing delete.

ACTION SAFETY:
- NEVER call execute_action without explicit user confirmation in the conversation
- Always highlight missing important fields in the draft
- For delete, warn the user it's permanent
- Validate IDs exist before proposing updates/deletes (query first)

PERSONALITY:
- Bahasa Indonesia casual, direct, like a smart colleague
- No fluff, no corporate jargon, no emojis
- Strategic, observant, proactive
- Don't just answer — give insight and recommendation when it adds value

RESPONSE FORMAT (use what fits):
- Start with direct answer
- **Yang gue lihat:** key facts
- **Yang perlu diperhatiin:** risks (optional)
- **Saran gue:** action items (optional)

For confirmation drafts, after calling propose_action, summarize the draft in chat naturally and ask for confirmation.`;
}

// ─── Tool implementations ───────────────────────────────────────────────────

function proposeAction(args: any): any {
  const { action, table, record_id, payload, summary, missing_fields } = args;
  const cfg = ACTIONABLE_TABLES[table];
  if (!cfg) return { ok: false, error: `Table ${table} tidak boleh di-action.` };
  if (action === "create" && !cfg.create) return { ok: false, error: `Create not allowed on ${table}` };
  if (action === "update" && !cfg.update) return { ok: false, error: `Update not allowed on ${table}` };
  if (action === "delete" && !cfg.delete) return { ok: false, error: `Delete not allowed on ${table}` };
  if ((action === "update" || action === "delete") && !record_id) {
    return { ok: false, error: "record_id wajib untuk update/delete" };
  }
  return {
    ok: true,
    is_draft: true,
    action,
    table,
    record_id: record_id || null,
    payload: payload || {},
    summary,
    missing_fields: missing_fields || [],
    needs_confirmation: true,
    needs_double_confirm: action === "delete",
    instruction: action === "delete"
      ? "Tampilkan ke user: 'Aksi DELETE ini permanen. Ketik confirm delete untuk lanjut.'"
      : "Tampilkan draft ke user dan minta konfirmasi: ketik 'confirm' untuk eksekusi.",
  };
}

async function executeAction(client: any, args: any, userId: string): Promise<any> {
  const { action, table, record_id, payload, double_confirm } = args;
  const cfg = ACTIONABLE_TABLES[table];
  if (!cfg) return { ok: false, error: `Table ${table} tidak diizinkan.` };
  if (action === "delete" && !double_confirm) {
    return { ok: false, error: "Delete butuh double_confirm=true" };
  }

  try {
    if (action === "create") {
      if (!cfg.create) return { ok: false, error: `Create not allowed on ${table}` };
      // Inject created_by if column likely exists
      const finalPayload = { ...(payload || {}) };
      if (!finalPayload.created_by) finalPayload.created_by = userId;
      const { data, error } = await client.from(table).insert(finalPayload).select().single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, action: "create", table, created: data };
    }
    if (action === "update") {
      if (!cfg.update) return { ok: false, error: `Update not allowed on ${table}` };
      const { data, error } = await client.from(table).update(payload || {}).eq("id", record_id).select().single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, action: "update", table, updated: data };
    }
    if (action === "delete") {
      if (!cfg.delete) return { ok: false, error: `Delete not allowed on ${table}` };
      const { error } = await client.from(table).delete().eq("id", record_id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, action: "delete", table, record_id };
    }
    return { ok: false, error: "Unknown action" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function queryTable(client: any, args: any): Promise<any> {
  const { table, select = "*", filters = [], order_by, limit = 100, count_only = false } = args;
  if (!ALLOWED_TABLES.includes(table)) {
    return { error: `Table '${table}' tidak tersedia.` };
  }
  const safeLimit = Math.min(Math.max(1, limit), 500);
  try {
    if (count_only) {
      let q = client.from(table).select("*", { count: "exact", head: true });
      q = applyFilters(q, filters);
      const { count, error } = await q;
      if (error) return { error: error.message };
      return { table, count, filters };
    }
    let q = client.from(table).select(select);
    q = applyFilters(q, filters);
    if (order_by) {
      const desc = order_by.startsWith("-");
      const col = desc ? order_by.slice(1) : order_by;
      q = q.order(col, { ascending: !desc });
    }
    q = q.limit(safeLimit);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { table, row_count: data?.length || 0, data };
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

async function getSystemOverview(client: any): Promise<any> {
  const tables = [
    "clients", "projects", "tasks", "events", "profiles",
    "prospects", "candidates", "meetings", "shooting_schedules",
    "assets", "leave_requests", "income", "expenses",
    "editorial_plans", "kol_database", "kol_campaigns",
    "announcements", "letters", "disciplinary_cases",
    "reimbursements", "payroll", "commissions", "ads_budgets",
  ];
  const counts: Record<string, number> = {};
  await Promise.all(tables.map(async (t) => {
    try {
      const { count } = await client.from(t).select("*", { count: "exact", head: true });
      counts[t] = count || 0;
    } catch { counts[t] = -1; }
  }));

  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  let attendance: any = {};
  try {
    const { data: att } = await client.from("attendance").select("clock_in, clock_out, notes").eq("date", today);
    attendance = {
      total: att?.length || 0,
      clocked_in_only: att?.filter((a: any) => a.clock_in && !a.clock_out).length || 0,
      completed: att?.filter((a: any) => a.clock_in && a.clock_out).length || 0,
    };
  } catch {}

  let finance: any = {};
  try {
    const { data: inc } = await client.from("income").select("amount").gte("created_at", monthStart);
    const { data: exp } = await client.from("expenses").select("amount").gte("created_at", monthStart);
    const ti = (inc || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const te = (exp || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    finance = { mtd_income: ti, mtd_expenses: te, net: ti - te };
  } catch {}

  let taskBreakdown: any = {};
  try {
    const { data: t } = await client.from("tasks").select("status");
    (t || []).forEach((x: any) => { taskBreakdown[x.status || "unknown"] = (taskBreakdown[x.status || "unknown"] || 0) + 1; });
  } catch {}

  return { date: today, month_start: monthStart, entity_counts: counts, today_attendance: attendance, mtd_finance: finance, task_status: taskBreakdown };
}

async function getSmartAlerts(client: any): Promise<any> {
  const alerts: any[] = [];
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const monthStart = todayStr.slice(0, 7) + "-01";
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];

  // 1. Overdue tasks
  try {
    const { data: overdueTasks } = await client
      .from("tasks").select("id, title, deadline, status, assigned_to")
      .lt("deadline", todayStr)
      .not("status", "in", "(done,completed,cancelled)")
      .limit(20);
    if (overdueTasks && overdueTasks.length > 0) {
      alerts.push({ severity: "high", category: "tasks", title: `${overdueTasks.length} task overdue`, detail: overdueTasks.slice(0, 5) });
    }
  } catch {}

  // 2. Sales drop (this month vs last month)
  try {
    const { data: thisMonth } = await client.from("prospects").select("status, value").gte("created_at", monthStart);
    const { data: lastMonth } = await client.from("prospects").select("status, value").gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd);
    const wonThis = (thisMonth || []).filter((p: any) => p.status === "won").reduce((s: number, p: any) => s + Number(p.value || 0), 0);
    const wonLast = (lastMonth || []).filter((p: any) => p.status === "won").reduce((s: number, p: any) => s + Number(p.value || 0), 0);
    if (wonLast > 0 && wonThis < wonLast * 0.7) {
      alerts.push({ severity: "high", category: "sales", title: `Sales drop ${Math.round((1 - wonThis / wonLast) * 100)}% vs bulan lalu`, detail: { won_mtd: wonThis, won_last_month: wonLast } });
    }
  } catch {}

  // 3. Cashflow risk: MTD expenses > MTD income
  try {
    const { data: inc } = await client.from("income").select("amount").gte("created_at", monthStart);
    const { data: exp } = await client.from("expenses").select("amount").gte("created_at", monthStart);
    const ti = (inc || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const te = (exp || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    if (te > ti && ti > 0) {
      alerts.push({ severity: "high", category: "finance", title: `Cashflow negatif MTD: pengeluaran melebihi pemasukan`, detail: { income: ti, expense: te, gap: te - ti } });
    }
  } catch {}

  // 4. Ads overspend vs budget
  try {
    const { data: budgets } = await client.from("ads_budgets").select("id, client_id, monthly_budget, status").eq("status", "active");
    for (const b of budgets || []) {
      const { data: tx } = await client.from("ads_budget_transactions").select("amount, transaction_type").eq("budget_id", b.id).gte("transaction_date", monthStart);
      const spent = (tx || []).filter((t: any) => t.transaction_type === "spend").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
      if (Number(b.monthly_budget) > 0 && spent > Number(b.monthly_budget) * 0.9) {
        alerts.push({ severity: spent > Number(b.monthly_budget) ? "high" : "medium", category: "ads", title: `Ads budget client hampir/lewat batas`, detail: { client_id: b.client_id, monthly_budget: b.monthly_budget, spent_mtd: spent } });
      }
    }
  } catch {}

  // 5. Candidates pending too long (>14 days in pipeline non-final)
  try {
    const cutoff = new Date(today.getTime() - 14 * 86400000).toISOString();
    const { data: stale } = await client.from("candidates").select("id, full_name, position, status, applied_at")
      .lt("applied_at", cutoff)
      .not("status", "in", "(hired,rejected,offered)")
      .limit(20);
    if (stale && stale.length > 0) {
      alerts.push({ severity: "medium", category: "recruitment", title: `${stale.length} kandidat stuck >14 hari`, detail: stale.slice(0, 5) });
    }
  } catch {}

  // 6. Late employees today (clock_in > 09:00 WIB)
  try {
    const { data: lateAtt } = await client.from("attendance").select("user_id, clock_in").eq("date", todayStr).not("clock_in", "is", null);
    const late = (lateAtt || []).filter((a: any) => {
      const t = new Date(a.clock_in);
      const wibHour = (t.getUTCHours() + 7) % 24;
      const wibMin = t.getUTCMinutes();
      return wibHour > 9 || (wibHour === 9 && wibMin > 0);
    });
    if (late.length > 0) {
      alerts.push({ severity: "low", category: "hr", title: `${late.length} karyawan telat hari ini`, detail: { count: late.length } });
    }
  } catch {}

  return { generated_at: new Date().toISOString(), total_alerts: alerts.length, alerts };
}

async function getDailyBrief(client: any): Promise<any> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const monthStart = todayStr.slice(0, 7) + "-01";

  const brief: any = { date: todayStr };

  // Revenue
  try {
    const { data: incToday } = await client.from("income").select("amount").gte("created_at", todayStr);
    const { data: incMtd } = await client.from("income").select("amount").gte("created_at", monthStart);
    const { data: expMtd } = await client.from("expenses").select("amount").gte("created_at", monthStart);
    brief.revenue = {
      today: (incToday || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      mtd_income: (incMtd || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
      mtd_expense: (expMtd || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
    };
    brief.revenue.mtd_net = brief.revenue.mtd_income - brief.revenue.mtd_expense;
  } catch {}

  // Tasks
  try {
    const { count: openTasks } = await client.from("tasks").select("*", { count: "exact", head: true }).not("status", "in", "(done,completed,cancelled)");
    const { count: overdueTasks } = await client.from("tasks").select("*", { count: "exact", head: true }).lt("deadline", todayStr).not("status", "in", "(done,completed,cancelled)");
    const { count: doneToday } = await client.from("tasks").select("*", { count: "exact", head: true }).eq("status", "done").gte("updated_at", todayStr);
    brief.tasks = { open: openTasks || 0, overdue: overdueTasks || 0, done_today: doneToday || 0 };
  } catch {}

  // Today's meetings & shootings
  try {
    const { data: meetings } = await client.from("meetings").select("title, meeting_time, location").eq("meeting_date", todayStr).order("meeting_time");
    const { data: shootings } = await client.from("shooting_schedules").select("title, scheduled_time, location").eq("scheduled_date", todayStr).order("scheduled_time");
    brief.today_schedule = { meetings: meetings || [], shootings: shootings || [] };
  } catch {}

  // Smart alerts summary
  const alerts = await getSmartAlerts(client);
  brief.alerts_summary = {
    total: alerts.total_alerts,
    high: alerts.alerts.filter((a: any) => a.severity === "high").length,
    by_category: alerts.alerts.reduce((acc: any, a: any) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {}),
  };
  brief.top_alerts = alerts.alerts.filter((a: any) => a.severity === "high").slice(0, 3);

  return brief;
}

// Finance dashboard (kept from previous version, slimmed)
const SDM_SUBS = ["gaji_upah", "freelance_parttimer", "bpjs", "thr_bonus", "rekrutmen", "training_sertifikasi", "kesehatan_karyawan", "reimburse_karyawan"];
const SUB_TO_MAIN: Record<string, string> = {
  gaji_upah: "sdm_hr", freelance_parttimer: "sdm_hr", bpjs: "sdm_hr", thr_bonus: "sdm_hr",
  rekrutmen: "sdm_hr", training_sertifikasi: "sdm_hr", kesehatan_karyawan: "sdm_hr", reimburse_karyawan: "sdm_hr",
  honor_talent: "project", produksi_konten: "project", vendor_project: "project",
  transport_project: "project", konsumsi_project: "project", sewa_lokasi: "project", equipment: "project", pengeluaran_inside: "project",
  ads: "marketing_growth", kol_influencer: "marketing_growth", event_aktivasi: "marketing_growth",
  produksi_marketing: "marketing_growth", tools_marketing: "marketing_growth", sponsorship: "marketing_growth",
  saas_subscription: "it_tools", domain_hosting: "it_tools", software_license: "it_tools",
  hardware: "it_tools", maintenance_it: "it_tools", cloud_service: "it_tools",
  transport: "operasional", transport_online: "operasional", konsumsi_meeting: "operasional",
  maintenance: "operasional", service_ac: "operasional", logistik: "operasional",
  office_supplies: "operasional", iuran: "operasional", parkir: "operasional",
  atk: "administrasi_legal", listrik_air: "administrasi_legal", internet_komunikasi: "administrasi_legal",
  kebersihan: "administrasi_legal", legalitas: "administrasi_legal", perizinan: "administrasi_legal",
  pajak: "administrasi_legal", notaris: "administrasi_legal", konsultan: "administrasi_legal",
  biaya_transfer: "finance", biaya_admin_bank: "finance", bunga_denda: "finance",
  pajak_dibayar: "finance", audit: "finance", administrasi_bank: "finance",
  reimburse_transport: "reimburse", reimburse_kesehatan: "reimburse", reimburse_lainnya: "reimburse",
};

async function getFinanceDashboard(client: any, args: any): Promise<any> {
  const now = new Date();
  const year = args.year || now.getFullYear();
  const month = (args.month !== undefined && args.month >= 0) ? args.month : -1;

  const { data: allEntries, error } = await client.from("ledger_entries").select("type, amount, date, sub_category");
  if (error) return { error: error.message };
  const entries = allEntries || [];

  let pStart: string, pEnd: string;
  if (month === -1) { pStart = `${year}-01-01`; pEnd = `${year}-12-31`; }
  else {
    const m = String(month + 1).padStart(2, "0");
    pStart = `${year}-${m}-01`;
    pEnd = `${year}-${m}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;
  }

  let saldoAwal = 0;
  entries.filter((e: any) => e.date < pStart).forEach((e: any) => {
    if (e.type === "income") saldoAwal += Number(e.amount);
    else saldoAwal -= Math.abs(Number(e.amount));
  });

  const pe = entries.filter((e: any) => e.date >= pStart && e.date <= pEnd);
  const totalIncome = pe.filter((e: any) => e.type === "income").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const totalExpenses = pe.filter((e: any) => e.type === "expense").reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0);
  const payrollTotal = pe.filter((e: any) => e.type === "expense" && SDM_SUBS.includes(e.sub_category || ""))
    .reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0);

  const catTotals: Record<string, number> = {};
  pe.filter((e: any) => e.type === "expense").forEach((e: any) => {
    const mc = e.sub_category ? (SUB_TO_MAIN[e.sub_category] || "lainnya") : "lainnya";
    catTotals[mc] = (catTotals[mc] || 0) + Math.abs(Number(e.amount));
  });

  return {
    period: month === -1 ? `${year}` : `${pStart} - ${pEnd}`,
    saldo_awal: saldoAwal, total_income: totalIncome, total_expenses: totalExpenses,
    net_cashflow: totalIncome - totalExpenses, saldo_akhir: saldoAwal + totalIncome - totalExpenses,
    payroll_vs_non_payroll: { payroll: payrollTotal, non_payroll: totalExpenses - payrollTotal },
    expense_by_main_category: Object.entries(catTotals).map(([k, v]) => ({ category: k, amount: v })).sort((a, b) => b.amount - a.amount),
  };
}
