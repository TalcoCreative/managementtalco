import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClockInEmailRequest {
  user_id: string;
}

interface TaskItem {
  title: string;
  type: 'task' | 'meeting' | 'shooting' | 'event';
  deadline?: string;
  status?: string;
  project?: string;
  isOverdue?: boolean;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return new Response(
        JSON.stringify({ success: false, error: "Email not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ClockInEmailRequest = await req.json();
    const { user_id } = body;

    if (!user_id) {
      throw new Error("user_id is required");
    }

    console.log("Processing clock-in summary for user:", user_id);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email, user_id")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      console.error("Failed to get user profile:", profileError);
      throw new Error("User profile not found");
    }

    const userEmail = profile.email || (profile.user_id?.includes("@") ? profile.user_id : null);
    if (!userEmail) {
      console.log("User has no email configured, skipping");
      return new Response(
        JSON.stringify({ success: false, error: "User has no email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userName = profile.full_name || "User";
    const firstName = userName.split(" ")[0];

    // Get today's date in Jakarta timezone (UTC+7)
    const now = new Date();
    const jakartaOffset = 7 * 60; // UTC+7 in minutes
    const jakartaTime = new Date(now.getTime() + (jakartaOffset + now.getTimezoneOffset()) * 60000);
    const todayStr = jakartaTime.toISOString().split("T")[0];
    
    // Yesterday for clock-out check
    const yesterday = new Date(jakartaTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    console.log("Fetching tasks for today:", todayStr);

    // Check if user forgot to clock out yesterday (has auto clock-out)
    const { data: yesterdayAttendance } = await supabase
      .from("attendance")
      .select("id, clock_out, notes")
      .eq("user_id", user_id)
      .eq("date", yesterdayStr)
      .maybeSingle();

    const forgotToClockOut = yesterdayAttendance?.notes?.includes("[AUTO CLOCK-OUT") || 
                             yesterdayAttendance?.notes?.includes("[Auto clock-out");

    // Get task assignees for this user (multi-assignee support)
    const { data: assignedTaskIds } = await supabase
      .from("task_assignees")
      .select("task_id")
      .eq("user_id", user_id);

    const assignedIds = assignedTaskIds?.map((t: any) => t.task_id) || [];

    // ============ TODAY'S TASKS ============
    // Fetch tasks with deadline TODAY that are NOT completed (assigned to user)
    const { data: todayTasks } = await supabase
      .from("tasks")
      .select("id, title, status, deadline, projects(title)")
      .eq("deadline", todayStr)
      .not("status", "in", '("done","completed","cancelled")')
      .or(`assigned_to.eq.${user_id}`);

    // Also fetch from task_assignees
    let additionalTodayTasks: any[] = [];
    if (assignedIds.length > 0) {
      const { data: moreTasks } = await supabase
        .from("tasks")
        .select("id, title, status, deadline, projects(title)")
        .in("id", assignedIds)
        .eq("deadline", todayStr)
        .not("status", "in", '("done","completed","cancelled")');
      additionalTodayTasks = moreTasks || [];
    }

    // ============ OVERDUE TASKS ============
    // Fetch overdue tasks (deadline before today) that are still incomplete
    const { data: overdueTasks } = await supabase
      .from("tasks")
      .select("id, title, status, deadline, projects(title)")
      .lt("deadline", todayStr)
      .not("status", "in", '("done","completed","cancelled")')
      .or(`assigned_to.eq.${user_id}`);

    let additionalOverdueTasks: any[] = [];
    if (assignedIds.length > 0) {
      const { data: moreTasks } = await supabase
        .from("tasks")
        .select("id, title, status, deadline, projects(title)")
        .in("id", assignedIds)
        .lt("deadline", todayStr)
        .not("status", "in", '("done","completed","cancelled")');
      additionalOverdueTasks = moreTasks || [];
    }

    // ============ TODAY'S MEETINGS ============
    const { data: userMeetings } = await supabase
      .from("meeting_participants")
      .select("meeting_id")
      .eq("user_id", user_id);

    const meetingIds = userMeetings?.map((m: any) => m.meeting_id) || [];
    
    let todayMeetings: any[] = [];
    if (meetingIds.length > 0) {
      const { data: meetings } = await supabase
        .from("meetings")
        .select("title, status, meeting_date, meeting_time, projects(title)")
        .in("id", meetingIds)
        .eq("meeting_date", todayStr)
        .not("status", "in", '("completed","cancelled")');
      todayMeetings = meetings || [];
    }

    // ============ TODAY'S SHOOTINGS ============
    const { data: userShootingsCrew } = await supabase
      .from("shooting_crew")
      .select("shooting_id")
      .eq("user_id", user_id);

    const shootingCrewIds = userShootingsCrew?.map((s: any) => s.shooting_id) || [];

    // Also get shootings where user is director, runner, or requester
    const { data: directShootings } = await supabase
      .from("shooting_schedules")
      .select("id")
      .or(`director.eq.${user_id},runner.eq.${user_id},requested_by.eq.${user_id}`);
    
    const allShootingIds = [...new Set([...shootingCrewIds, ...(directShootings?.map((s: any) => s.id) || [])])];

    let todayShootings: any[] = [];
    if (allShootingIds.length > 0) {
      const { data: shootings } = await supabase
        .from("shooting_schedules")
        .select("title, status, scheduled_date, projects(title)")
        .in("id", allShootingIds)
        .eq("scheduled_date", todayStr)
        .not("status", "in", '("completed","cancelled","rejected")');
      todayShootings = shootings || [];
    }

    // ============ TODAY'S EVENTS ============
    const { data: userEventsCrew } = await supabase
      .from("event_crew")
      .select("event_id")
      .eq("user_id", user_id);

    const eventCrewIds = userEventsCrew?.map((e: any) => e.event_id) || [];

    // Also get events where user is PIC or creator
    const { data: directEvents } = await supabase
      .from("events")
      .select("id")
      .or(`pic_id.eq.${user_id},created_by.eq.${user_id}`);
    
    const allEventIds = [...new Set([...eventCrewIds, ...(directEvents?.map((e: any) => e.id) || [])])];

    let todayEvents: any[] = [];
    if (allEventIds.length > 0) {
      // Events that are happening today (start_date <= today <= end_date)
      const { data: events } = await supabase
        .from("events")
        .select("name, status, start_date, end_date, projects(title)")
        .in("id", allEventIds)
        .lte("start_date", todayStr)
        .gte("end_date", todayStr)
        .not("status", "in", '("completed","cancelled")');
      todayEvents = events || [];
    }

    // ============ COMBINE ALL TODAY'S ITEMS ============
    const allTodayTasks = [...(todayTasks || []), ...additionalTodayTasks];
    const uniqueTodayTasks = allTodayTasks.filter((task, index, self) =>
      index === self.findIndex((t) => t.id === task.id)
    );

    const allOverdueTasks = [...(overdueTasks || []), ...additionalOverdueTasks];
    const uniqueOverdueTasks = allOverdueTasks.filter((task, index, self) =>
      index === self.findIndex((t) => t.id === task.id)
    );

    // Build items for TODAY
    const todayItems: TaskItem[] = [
      ...uniqueTodayTasks.map((t: any) => ({
        title: t.title,
        type: 'task' as const,
        deadline: t.deadline,
        status: t.status,
        project: t.projects?.title,
        isOverdue: false,
      })),
      ...todayMeetings.map((m: any) => ({
        title: m.title,
        type: 'meeting' as const,
        deadline: m.meeting_date,
        status: m.status,
        project: m.projects?.title,
        isOverdue: false,
      })),
      ...todayShootings.map((s: any) => ({
        title: s.title,
        type: 'shooting' as const,
        deadline: s.scheduled_date,
        status: s.status,
        project: s.projects?.title,
        isOverdue: false,
      })),
      ...todayEvents.map((e: any) => ({
        title: e.name,
        type: 'event' as const,
        deadline: e.start_date,
        status: e.status,
        project: e.projects?.title,
        isOverdue: false,
      })),
    ];

    // Build items for OVERDUE
    const overdueItems: TaskItem[] = uniqueOverdueTasks.map((t: any) => ({
      title: t.title,
      type: 'task' as const,
      deadline: t.deadline,
      status: t.status,
      project: t.projects?.title,
      isOverdue: true,
    }));

    console.log(`Found ${todayItems.length} today items, ${overdueItems.length} overdue items`);

    // Build email HTML
    const emailHtml = buildSummaryEmail(firstName, todayItems, overdueItems, todayStr, forgotToClockOut);

    // Get email settings
    const { data: settings } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    const senderName = settings?.sender_name || "Talco System";
    const senderEmail = settings?.smtp_email || "onboarding@resend.dev";
    const fromAddress = `${senderName} <${senderEmail}>`;

    // Send email
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [userEmail],
        subject: `Hi ${firstName}, ini kerjaan kamu hari ini 👋`,
        html: emailHtml,
      }),
    });

    const emailResult = await response.json();
    console.log("Email send result:", JSON.stringify(emailResult, null, 2));

    if (!response.ok) {
      console.error("Failed to send email:", emailResult);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.message || "Email failed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the email
    await supabase.from("email_logs").insert({
      recipient_email: userEmail,
      recipient_name: userName,
      subject: `Hi ${firstName}, ini kerjaan kamu hari ini 👋`,
      body: emailHtml,
      notification_type: "clockin_summary",
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    console.log("Clock-in summary email sent successfully!");

    return new Response(
      JSON.stringify({ success: true, message: "Summary email sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending clock-in summary email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function buildSummaryEmail(
  firstName: string,
  todayItems: TaskItem[],
  overdueItems: TaskItem[],
  todayStr: string,
  forgotToClockOut: boolean = false
): string {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task': return '📋';
      case 'meeting': return '📅';
      case 'shooting': return '🎥';
      case 'event': return '🎪';
      default: return '📌';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'task': return 'Task';
      case 'meeting': return 'Meeting';
      case 'shooting': return 'Shooting';
      case 'event': return 'Event';
      default: return 'Item';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'todo': return '#f59e0b';
      case 'in_progress': return '#3b82f6';
      case 'pending': return '#6b7280';
      case 'revise': return '#ef4444';
      case 'approved': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'todo': return 'To Do';
      case 'in_progress': return 'In Progress';
      case 'pending': return 'Pending';
      case 'revise': return 'Revise';
      case 'approved': return 'Approved';
      case 'scheduled': return 'Scheduled';
      case 'confirmed': return 'Confirmed';
      default: return status?.replace('_', ' ') || '-';
    }
  };

  // Today's work section
  let todaySection = '';
  if (todayItems.length > 0) {
    todaySection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2563eb; font-size: 16px; margin: 0 0 12px 0;">📌 Kerjaan Hari Ini (${todayItems.length})</h3>
        <div style="background-color: #eff6ff; border-radius: 8px; padding: 12px;">
          ${todayItems.map(item => `
            <div style="padding: 10px 0; border-bottom: 1px solid #dbeafe;">
              <div style="display: flex; align-items: center;">
                <span style="margin-right: 8px;">${getTypeIcon(item.type)}</span>
                <div style="flex: 1;">
                  <span style="color: #333; font-weight: 500;">${item.title}</span>
                  <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">(${getTypeLabel(item.type)})</span>
                  ${item.project ? `<span style="color: #9ca3af; font-size: 12px; display: block;">${item.project}</span>` : ''}
                </div>
              </div>
              <div style="display: flex; gap: 12px; margin-top: 6px; margin-left: 28px;">
                ${item.status ? `
                  <span style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background-color: ${getStatusColor(item.status)}20; color: ${getStatusColor(item.status)};">
                    ${getStatusLabel(item.status)}
                  </span>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    todaySection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2563eb; font-size: 16px; margin: 0 0 12px 0;">📌 Kerjaan Hari Ini</h3>
        <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center; color: #16a34a;">
          🎉 Tidak ada kerjaan yang di-assign untuk hari ini! Santai dulu~
        </div>
      </div>
    `;
  }

  // Overdue section
  let overdueSection = '';
  if (overdueItems.length > 0) {
    overdueSection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #ef4444; font-size: 16px; margin: 0 0 12px 0;">⚠️ Overdue - Harus Segera Dikerjakan (${overdueItems.length})</h3>
        <div style="background-color: #fef2f2; border-radius: 8px; padding: 12px;">
          ${overdueItems.map(item => `
            <div style="padding: 10px 0; border-bottom: 1px solid #fecaca;">
              <div style="display: flex; align-items: center;">
                <span style="margin-right: 8px;">${getTypeIcon(item.type)}</span>
                <div style="flex: 1;">
                  <span style="color: #333; font-weight: 500;">${item.title}</span>
                  <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">(${getTypeLabel(item.type)})</span>
                  ${item.project ? `<span style="color: #9ca3af; font-size: 12px; display: block;">${item.project}</span>` : ''}
                </div>
              </div>
              <div style="display: flex; gap: 12px; margin-top: 6px; margin-left: 28px;">
                <span style="font-size: 12px; color: #ef4444;">
                  📅 Deadline: ${formatDate(item.deadline)} (Overdue!)
                </span>
                ${item.status ? `
                  <span style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background-color: ${getStatusColor(item.status)}20; color: ${getStatusColor(item.status)};">
                    ${getStatusLabel(item.status)}
                  </span>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Kerjaan Hari Ini - Talco System</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Talco System</h1>
        </div>
        
        ${forgotToClockOut ? `
        <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0; color: #dc2626; font-weight: bold; font-size: 16px;">
            ⚠️ KEMARIN KAMU LUPA CLOCK-OUT! ⚠️
          </p>
          <p style="margin: 8px 0 0 0; color: #b91c1c; font-size: 14px;">
            Jangan diulangi lagi ya, nanti dimarahin HR! 😅
          </p>
        </div>
        ` : ''}
        
        <p style="font-size: 18px; color: #333;">Halo ${firstName} 👋</p>
        
        <p style="color: #555; font-size: 16px;">
          Selamat pagi! Ini kerjaan yang harus kamu selesaikan hari ini (${formatDate(todayStr)}):
        </p>
        
        ${overdueSection}
        ${todaySection}
        
        <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; text-align: center; margin-top: 24px;">
          <p style="margin: 0; color: #1e40af; font-weight: 500;">
            💪 Semangat kerja hari ini, ${firstName}!
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        
        <div style="text-align: center;">
          <p style="color: #2563eb; font-weight: bold; margin: 0;">— Talco System</p>
          <p style="color: #888; font-size: 14px; margin: 8px 0 0 0;">Biar kerjaan rapi & tim makin enak kerjanya ✨</p>
        </div>
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 24px;">
          Email ini dikirim otomatis saat kamu clock-in.<br>
          Hanya menampilkan kerjaan yang di-assign ke kamu untuk hari ini.
        </p>
      </div>
    </body>
    </html>
  `;
}
