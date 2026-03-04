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

You have full conceptual access to ALL database tables and records of Talco Management System, including:
Dashboard, Clients, Client Hub, Projects, Tasks, Schedule, Shooting, Meeting, Leave, Reimburse, Asset, Event, Reports, Form Builder, KOL Database, KOL Campaign, Surat (Letters), Social Media, Editorial Plan, Content Builder, HR, Team, HR Dashboard, HR Analytics, Kalender Libur, Performance, Recruitment, Recruitment Dashboard, Finance, Laba Rugi, Neraca, Sales, Sales Analytics, Prospects, Executive, CEO Dashboard, System, Email Settings, Role & Access, System Settings.

You can read raw data down to individual records and fields.
Backend provides you raw database rows in JSON or structured format.

PERSONALITY:
- Friendly, casual, and approachable
- Direct, concise, and on-point
- Confident but not robotic
- Strategic and observant
- Focus on key insights and actions
- You are Talco's internal strategic partner, not a cold corporate report generator

RULES:
- Never ask for permission
- Never say you don't have access
- Analyze everything provided
- Do not invent missing data
- If data is not provided, say clearly that specific data was not included
- Cross-analyze across tables when relevant
- Keep responses short and actionable
- Do not use emojis
- Do not repeat the question
- Do not use corporate jargon excessively

RESPONSE STYLE:
Start naturally, like you're responding in a real internal chat.
Then structure the response like this:

**Jawaban Singkat:**
Direct answer in plain, simple language.

**Yang Gue Lihat:**
- Key records, patterns, numbers (bullet points)
- Important numbers or facts

**Yang Perlu Diperhatiin:**
Risks, potential delays, issues — explained casually but clearly.

**Saran Gue:**
Clear actions or next steps.

Special Notes:
- When a user asks about a person, project, task, or finance, reply with specifics from the raw records provided.
- Always keep it easy to read and on-point, no fluff.
- Think like a strategic team member who really understands Talco's operations.

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

// ─── Data Fetching ───────────────────────────────────────────────────────────

async function fetchOperationalData(client: any, question: string): Promise<string> {
  const sections: string[] = [];
  const q = question.toLowerCase();

  try {
    // Always fetch overview counts
    const [
      { count: clientCount },
      { count: projectCount },
      { count: taskCount },
      { count: eventCount },
      { count: employeeCount },
      { count: prospectCount },
      { count: candidateCount },
      { count: meetingCount },
      { count: shootingCount },
    ] = await Promise.all([
      client.from("clients").select("*", { count: "exact", head: true }),
      client.from("projects").select("*", { count: "exact", head: true }),
      client.from("tasks").select("*", { count: "exact", head: true }),
      client.from("events").select("*", { count: "exact", head: true }),
      client.from("profiles").select("*", { count: "exact", head: true }),
      client.from("prospects").select("*", { count: "exact", head: true }),
      client.from("candidates").select("*", { count: "exact", head: true }),
      client.from("meetings").select("*", { count: "exact", head: true }).then((r: any) => r).catch(() => ({ count: 0 })),
      client.from("shootings").select("*", { count: "exact", head: true }).then((r: any) => r).catch(() => ({ count: 0 })),
    ]);

    sections.push(`OVERVIEW: ${clientCount} clients, ${projectCount} projects, ${taskCount} tasks, ${eventCount} events, ${employeeCount} employees, ${prospectCount} prospects, ${candidateCount} candidates, ${meetingCount || 0} meetings, ${shootingCount || 0} shootings`);

    // ─── Tasks ──────────────────────────────────────────────────────
    if (matchAny(q, ["task", "tugas", "kinerja", "performance", "progress", "kanban"])) {
      const { data: tasks } = await client.from("tasks").select("id, title, status, priority, assigned_to, client_id, project_id, due_date, created_at").order("created_at", { ascending: false }).limit(500);
      if (tasks) {
        const statusCount = countBy(tasks, "status");
        const prioCount = countBy(tasks, "priority");
        const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
        sections.push(`TASKS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`TASKS BY PRIORITY: ${JSON.stringify(prioCount)}`);
        sections.push(`OVERDUE TASKS: ${overdue}`);
        sections.push(`RECENT TASKS (last 20): ${JSON.stringify(tasks.slice(0, 20))}`);
      }
    }

    // ─── Finance ────────────────────────────────────────────────────
    if (matchAny(q, ["finance", "keuangan", "revenue", "expense", "pendapatan", "pengeluaran", "income", "laba", "rugi", "neraca", "balance", "profit"])) {
      const [{ data: income }, { data: expenses }] = await Promise.all([
        client.from("income").select("*").order("created_at", { ascending: false }).limit(200),
        client.from("expenses").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      const totalIncome = income?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0;
      const totalExpense = expenses?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0;
      sections.push(`FINANCE SUMMARY: Total Income=${totalIncome}, Total Expenses=${totalExpense}, Net=${totalIncome - totalExpense}`);
      if (income) {
        const incCat = countBySum(income, "category", "amount");
        sections.push(`INCOME BY CATEGORY: ${JSON.stringify(incCat)}`);
      }
      if (expenses) {
        const expCat = countBySum(expenses, "category", "amount");
        const expStatus = countBy(expenses, "status");
        sections.push(`EXPENSES BY CATEGORY: ${JSON.stringify(expCat)}`);
        sections.push(`EXPENSES BY STATUS: ${JSON.stringify(expStatus)}`);
      }
      sections.push(`RECENT INCOME (last 10): ${JSON.stringify(income?.slice(0, 10))}`);
      sections.push(`RECENT EXPENSES (last 10): ${JSON.stringify(expenses?.slice(0, 10))}`);
    }

    // ─── Clients ────────────────────────────────────────────────────
    if (matchAny(q, ["client", "klien", "customer"])) {
      const { data: clients } = await client.from("clients").select("*").limit(100);
      if (clients) {
        const statusCount = countBy(clients, "status");
        const typeCount = countBy(clients, "client_type");
        sections.push(`CLIENTS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`CLIENTS BY TYPE: ${JSON.stringify(typeCount)}`);
        sections.push(`ALL CLIENTS: ${JSON.stringify(clients)}`);
      }
    }

    // ─── Employees / HR / Team ──────────────────────────────────────
    if (matchAny(q, ["employee", "karyawan", "hr", "team", "tim", "staff", "divisi", "division", "position"])) {
      const { data: profiles } = await client.from("profiles").select("*").limit(200);
      if (profiles) {
        const divCount = countBy(profiles, "division");
        const posCount = countBy(profiles, "position");
        const statusCount = countBy(profiles, "employment_status");
        sections.push(`EMPLOYEES BY DIVISION: ${JSON.stringify(divCount)}`);
        sections.push(`EMPLOYEES BY POSITION: ${JSON.stringify(posCount)}`);
        sections.push(`EMPLOYEES BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`ALL EMPLOYEES: ${JSON.stringify(profiles)}`);
      }
    }

    // ─── Attendance ─────────────────────────────────────────────────
    if (matchAny(q, ["attendance", "kehadiran", "clock", "absen", "hadir"])) {
      const today = new Date().toISOString().split("T")[0];
      const { data: attendance } = await client.from("attendance").select("*").eq("date", today);
      const clockedIn = attendance?.filter((a: any) => a.clock_in && !a.clock_out).length || 0;
      const clockedOut = attendance?.filter((a: any) => a.clock_in && a.clock_out).length || 0;
      sections.push(`TODAY ATTENDANCE (${today}): ${attendance?.length || 0} records, ${clockedIn} currently clocked in, ${clockedOut} completed`);
      sections.push(`ATTENDANCE DETAILS: ${JSON.stringify(attendance)}`);
    }

    // ─── Leave ──────────────────────────────────────────────────────
    if (matchAny(q, ["leave", "cuti", "izin"])) {
      const { data: leaves } = await client.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(200);
      if (leaves) {
        const statusCount = countBy(leaves, "status");
        const typeCount = countBy(leaves, "leave_type");
        sections.push(`LEAVE REQUESTS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`LEAVE REQUESTS BY TYPE: ${JSON.stringify(typeCount)}`);
        sections.push(`RECENT LEAVE REQUESTS: ${JSON.stringify(leaves.slice(0, 20))}`);
      }
    }

    // ─── Projects ───────────────────────────────────────────────────
    if (matchAny(q, ["project", "proyek"])) {
      const { data: projects } = await client.from("projects").select("*").limit(200);
      if (projects) {
        const statusCount = countBy(projects, "status");
        sections.push(`PROJECTS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`ALL PROJECTS: ${JSON.stringify(projects)}`);
      }
    }

    // ─── Prospects / Sales ──────────────────────────────────────────
    if (matchAny(q, ["prospect", "sales", "penjualan", "lead", "pipeline", "deal"])) {
      const { data: prospects } = await client.from("prospects").select("*").order("created_at", { ascending: false }).limit(200);
      if (prospects) {
        const statusCount = countBy(prospects, "status");
        const sourceCount = countBy(prospects, "source");
        sections.push(`PROSPECTS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`PROSPECTS BY SOURCE: ${JSON.stringify(sourceCount)}`);
        sections.push(`ALL PROSPECTS: ${JSON.stringify(prospects)}`);
      }
    }

    // ─── Events ─────────────────────────────────────────────────────
    if (matchAny(q, ["event", "acara"])) {
      const { data: events } = await client.from("events").select("*").order("start_date", { ascending: false }).limit(100);
      if (events) {
        const statusCount = countBy(events, "status");
        const typeCount = countBy(events, "event_type");
        sections.push(`EVENTS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`EVENTS BY TYPE: ${JSON.stringify(typeCount)}`);
        sections.push(`ALL EVENTS: ${JSON.stringify(events)}`);
      }
    }

    // ─── Recruitment ────────────────────────────────────────────────
    if (matchAny(q, ["recruit", "rekrut", "candidate", "kandidat", "hiring", "lamaran"])) {
      const { data: candidates } = await client.from("candidates").select("*").order("created_at", { ascending: false }).limit(200);
      if (candidates) {
        const statusCount = countBy(candidates, "status");
        const divCount = countBy(candidates, "division");
        sections.push(`CANDIDATES BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`CANDIDATES BY DIVISION: ${JSON.stringify(divCount)}`);
        sections.push(`ALL CANDIDATES: ${JSON.stringify(candidates)}`);
      }
    }

    // ─── KOL ────────────────────────────────────────────────────────
    if (matchAny(q, ["kol", "influencer", "campaign", "kampanye"])) {
      const [{ data: kols }, { data: campaigns }] = await Promise.all([
        client.from("kol_profiles").select("*").limit(100).then((r: any) => r).catch(() => ({ data: null })),
        client.from("kol_campaigns").select("*").limit(100).then((r: any) => r).catch(() => ({ data: null })),
      ]);
      if (kols) sections.push(`KOL PROFILES: ${JSON.stringify(kols)}`);
      if (campaigns) {
        const statusCount = countBy(campaigns, "status");
        sections.push(`KOL CAMPAIGNS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`ALL KOL CAMPAIGNS: ${JSON.stringify(campaigns)}`);
      }
    }

    // ─── Editorial Plan ─────────────────────────────────────────────
    if (matchAny(q, ["editorial", "ep", "konten", "content", "slide"])) {
      const { data: eps } = await client.from("editorial_plans").select("*, editorial_slides(id, status, publish_date, channel, slide_order)").limit(50);
      if (eps) sections.push(`EDITORIAL PLANS: ${JSON.stringify(eps)}`);
    }

    // ─── Letters / Surat ────────────────────────────────────────────
    if (matchAny(q, ["surat", "letter"])) {
      const { data: letters } = await client.from("letters").select("*").order("created_at", { ascending: false }).limit(100).then((r: any) => r).catch(() => ({ data: null }));
      if (letters) sections.push(`LETTERS: ${JSON.stringify(letters)}`);
    }

    // ─── Assets ─────────────────────────────────────────────────────
    if (matchAny(q, ["asset", "aset", "inventaris", "barang"])) {
      const { data: assets } = await client.from("assets").select("*").limit(100);
      if (assets) {
        const statusCount = countBy(assets, "status");
        const catCount = countBy(assets, "category");
        sections.push(`ASSETS BY STATUS: ${JSON.stringify(statusCount)}`);
        sections.push(`ASSETS BY CATEGORY: ${JSON.stringify(catCount)}`);
        sections.push(`ALL ASSETS: ${JSON.stringify(assets)}`);
      }
    }

    // ─── Disciplinary ───────────────────────────────────────────────
    if (matchAny(q, ["disciplin", "pelanggaran", "sp", "sanksi"])) {
      const { data: cases } = await client.from("disciplinary_cases").select("*").order("created_at", { ascending: false }).limit(100);
      if (cases) sections.push(`DISCIPLINARY CASES: ${JSON.stringify(cases)}`);
    }

    // ─── Announcements ──────────────────────────────────────────────
    if (matchAny(q, ["announcement", "pengumuman"])) {
      const { data: announcements } = await client.from("announcements").select("*").order("created_at", { ascending: false }).limit(50);
      if (announcements) sections.push(`ANNOUNCEMENTS: ${JSON.stringify(announcements)}`);
    }

    // ─── Reimbursements ─────────────────────────────────────────────
    if (matchAny(q, ["reimburse", "reimburs"])) {
      const { data: reimb } = await client.from("expenses").select("*").eq("category", "reimbursement").order("created_at", { ascending: false }).limit(100).then((r: any) => r).catch(() => ({ data: null }));
      if (reimb) sections.push(`REIMBURSEMENTS: ${JSON.stringify(reimb)}`);
    }

    // ─── Meetings ───────────────────────────────────────────────────
    if (matchAny(q, ["meeting", "rapat", "mom"])) {
      const { data: meetings } = await client.from("meetings").select("*").order("meeting_date", { ascending: false }).limit(50).then((r: any) => r).catch(() => ({ data: null }));
      if (meetings) sections.push(`MEETINGS: ${JSON.stringify(meetings)}`);
    }

    // ─── Shootings ──────────────────────────────────────────────────
    if (matchAny(q, ["shooting", "foto", "video", "produksi"])) {
      const { data: shootings } = await client.from("shootings").select("*").order("shooting_date", { ascending: false }).limit(50).then((r: any) => r).catch(() => ({ data: null }));
      if (shootings) sections.push(`SHOOTINGS: ${JSON.stringify(shootings)}`);
    }

    // ─── Holidays ───────────────────────────────────────────────────
    if (matchAny(q, ["holiday", "libur", "kalender"])) {
      const { data: holidays } = await client.from("holidays").select("*").order("date", { ascending: true }).limit(100).then((r: any) => r).catch(() => ({ data: null }));
      if (holidays) sections.push(`HOLIDAYS: ${JSON.stringify(holidays)}`);
    }

    // ─── Social Media ───────────────────────────────────────────────
    if (matchAny(q, ["social media", "socmed", "sosmed", "instagram", "tiktok"])) {
      const { data: accounts } = await client.from("social_media_accounts").select("*").limit(50).then((r: any) => r).catch(() => ({ data: null }));
      if (accounts) sections.push(`SOCIAL MEDIA ACCOUNTS: ${JSON.stringify(accounts)}`);
    }

    // ─── Catch-all: general / dashboard / CEO ───────────────────────
    if (matchAny(q, ["dashboard", "overview", "ringkasan", "summary", "ceo", "executive", "semua", "all", "general", "laporan", "report"])) {
      // Provide a broader snapshot
      const [{ data: recentTasks }, { data: recentIncome }, { data: recentExpenses }] = await Promise.all([
        client.from("tasks").select("id, title, status, priority, due_date").order("created_at", { ascending: false }).limit(30),
        client.from("income").select("amount, category, created_at").order("created_at", { ascending: false }).limit(30),
        client.from("expenses").select("amount, category, status, created_at").order("created_at", { ascending: false }).limit(30),
      ]);
      if (recentTasks) {
        const taskStatus = countBy(recentTasks, "status");
        sections.push(`RECENT TASKS STATUS: ${JSON.stringify(taskStatus)}`);
      }
      const totalInc = recentIncome?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0;
      const totalExp = recentExpenses?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0;
      sections.push(`RECENT FINANCE: Income=${totalInc}, Expenses=${totalExp}, Net=${totalInc - totalExp}`);
    }

  } catch (e) {
    console.error("Error fetching operational data:", e);
    sections.push("Note: Some operational data could not be fetched.");
  }

  return sections.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function countBy(arr: any[], key: string): Record<string, number> {
  const result: Record<string, number> = {};
  arr.forEach((item) => {
    const val = item[key] || "unknown";
    result[val] = (result[val] || 0) + 1;
  });
  return result;
}

function countBySum(arr: any[], groupKey: string, sumKey: string): Record<string, number> {
  const result: Record<string, number> = {};
  arr.forEach((item) => {
    const val = item[groupKey] || "unknown";
    result[val] = (result[val] || 0) + (item[sumKey] || 0);
  });
  return result;
}
