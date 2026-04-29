// TASSA Daily Brief — runs via cron 08:00 WIB.
// Pulls executive brief and sends formatted WhatsApp message via Fonnte
// to all users in super_admin role (acting as CEO/leadership).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtIDR(n: number): string {
  if (!n && n !== 0) return "Rp 0";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function buildMessage(brief: any): string {
  const lines: string[] = [];
  lines.push(`*TASSA Daily Brief — ${brief.date}*`);
  lines.push("");
  if (brief.revenue) {
    lines.push(`*💰 Revenue*`);
    lines.push(`Hari ini: ${fmtIDR(brief.revenue.today)}`);
    lines.push(`MTD Income: ${fmtIDR(brief.revenue.mtd_income)}`);
    lines.push(`MTD Expense: ${fmtIDR(brief.revenue.mtd_expense)}`);
    lines.push(`Net MTD: ${fmtIDR(brief.revenue.mtd_net)}`);
    lines.push("");
  }
  if (brief.tasks) {
    lines.push(`*📋 Tasks*`);
    lines.push(`Open: ${brief.tasks.open} | Overdue: ${brief.tasks.overdue} | Done today: ${brief.tasks.done_today}`);
    lines.push("");
  }
  if (brief.today_schedule) {
    const m = brief.today_schedule.meetings || [];
    const s = brief.today_schedule.shootings || [];
    if (m.length || s.length) {
      lines.push(`*📅 Hari Ini*`);
      m.slice(0, 5).forEach((x: any) => lines.push(`• Meeting ${x.meeting_time || ""} - ${x.title}`));
      s.slice(0, 5).forEach((x: any) => lines.push(`• Shooting ${x.scheduled_time || ""} - ${x.title}`));
      lines.push("");
    }
  }
  if (brief.alerts_summary && brief.alerts_summary.total > 0) {
    lines.push(`*🚨 Alerts: ${brief.alerts_summary.total} (${brief.alerts_summary.high} high)*`);
    (brief.top_alerts || []).forEach((a: any) => lines.push(`• [${a.severity.toUpperCase()}] ${a.title}`));
    lines.push("");
  }
  lines.push(`_Buka Tassa di app untuk dig deeper._`);
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceKey);

    // 1. Build brief by calling the ai-agent function in mode=daily_brief
    const briefResp = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        apikey: serviceKey,
      },
      body: JSON.stringify({ mode: "daily_brief" }),
    });

    let brief: any = {};
    if (briefResp.ok) brief = await briefResp.json();
    else {
      // fall back: build a minimal brief inline
      brief = { date: new Date().toISOString().split("T")[0] };
    }

    const msg = buildMessage(brief);

    // 2. Find recipients: super_admin role + has phone
    const { data: roleRows } = await client.from("user_roles").select("user_id").eq("role", "super_admin");
    const userIds = (roleRows || []).map((r: any) => r.user_id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no super_admin users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await client.from("profiles").select("id, full_name, phone").in("id", userIds);
    const recipients = (profiles || []).filter((p: any) => p.phone);

    let sent = 0;
    const errors: any[] = [];
    for (const r of recipients) {
      try {
        const waResp = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            apikey: serviceKey,
          },
          body: JSON.stringify({
            phone: r.phone,
            message: msg,
            event_type: "tassa_daily_brief",
          }),
        });
        if (waResp.ok) sent++;
        else {
          const t = await waResp.text();
          errors.push({ user: r.full_name, status: waResp.status, body: t.slice(0, 200) });
        }
      } catch (e) {
        errors.push({ user: r.full_name, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, total_recipients: recipients.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tassa-daily-brief error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
