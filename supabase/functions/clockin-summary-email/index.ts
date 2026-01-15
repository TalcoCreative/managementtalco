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

    // Get yesterday's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    console.log("Fetching tasks for user. Yesterday:", yesterdayStr, "Today:", todayStr);

    // Fetch completed tasks yesterday
    const { data: completedTasks } = await supabase
      .from("tasks")
      .select("title, status, deadline, updated_at, projects(title)")
      .or(`assigned_to.eq.${user_id},created_by.eq.${user_id}`)
      .in("status", ["done", "completed"])
      .gte("updated_at", `${yesterdayStr}T00:00:00`)
      .lt("updated_at", `${todayStr}T00:00:00`);

    // Also check task_assignees for multi-assignee tasks
    const { data: assignedTaskIds } = await supabase
      .from("task_assignees")
      .select("task_id")
      .eq("user_id", user_id);

    const assignedIds = assignedTaskIds?.map((t: any) => t.task_id) || [];

    let additionalCompletedTasks: any[] = [];
    if (assignedIds.length > 0) {
      const { data: moreTasks } = await supabase
        .from("tasks")
        .select("title, status, deadline, updated_at, projects(title)")
        .in("id", assignedIds)
        .in("status", ["done", "completed"])
        .gte("updated_at", `${yesterdayStr}T00:00:00`)
        .lt("updated_at", `${todayStr}T00:00:00`);
      additionalCompletedTasks = moreTasks || [];
    }

    // Fetch incomplete tasks
    const { data: incompleteTasks } = await supabase
      .from("tasks")
      .select("title, status, deadline, projects(title)")
      .or(`assigned_to.eq.${user_id},created_by.eq.${user_id}`)
      .in("status", ["todo", "in_progress", "pending", "revise"]);

    let additionalIncompleteTasks: any[] = [];
    if (assignedIds.length > 0) {
      const { data: moreTasks } = await supabase
        .from("tasks")
        .select("title, status, deadline, projects(title)")
        .in("id", assignedIds)
        .in("status", ["todo", "in_progress", "pending", "revise"]);
      additionalIncompleteTasks = moreTasks || [];
    }

    // Fetch meetings
    const { data: userMeetings } = await supabase
      .from("meeting_participants")
      .select("meeting_id")
      .eq("user_id", user_id);

    const meetingIds = userMeetings?.map((m: any) => m.meeting_id) || [];
    
    let incompleteMeetings: any[] = [];
    let completedMeetings: any[] = [];
    
    if (meetingIds.length > 0) {
      // Incomplete meetings
      const { data: meetings } = await supabase
        .from("meetings")
        .select("title, status, meeting_date, projects(title)")
        .in("id", meetingIds)
        .in("status", ["pending", "scheduled", "confirmed"]);
      incompleteMeetings = meetings || [];

      // Completed meetings yesterday
      const { data: doneMeetings } = await supabase
        .from("meetings")
        .select("title, status, meeting_date, updated_at, projects(title)")
        .in("id", meetingIds)
        .eq("status", "completed")
        .gte("updated_at", `${yesterdayStr}T00:00:00`)
        .lt("updated_at", `${todayStr}T00:00:00`);
      completedMeetings = doneMeetings || [];
    }

    // Fetch shootings
    const { data: userShootingsCrew } = await supabase
      .from("shooting_crew")
      .select("shooting_id")
      .eq("user_id", user_id);

    const shootingIds = userShootingsCrew?.map((s: any) => s.shooting_id) || [];

    // Also get shootings where user is director, runner, or requester
    const { data: directShootings } = await supabase
      .from("shooting_schedules")
      .select("id")
      .or(`director.eq.${user_id},runner.eq.${user_id},requested_by.eq.${user_id}`);
    
    const allShootingIds = [...new Set([...shootingIds, ...(directShootings?.map((s: any) => s.id) || [])])];

    let incompleteShootings: any[] = [];
    let completedShootings: any[] = [];

    if (allShootingIds.length > 0) {
      // Incomplete shootings
      const { data: shootings } = await supabase
        .from("shooting_schedules")
        .select("title, status, scheduled_date, projects(title)")
        .in("id", allShootingIds)
        .in("status", ["pending", "approved"]);
      incompleteShootings = shootings || [];

      // Completed shootings yesterday
      const { data: doneShootings } = await supabase
        .from("shooting_schedules")
        .select("title, status, scheduled_date, projects(title)")
        .in("id", allShootingIds)
        .eq("status", "completed")
        .eq("scheduled_date", yesterdayStr);
      completedShootings = doneShootings || [];
    }

    // Fetch events
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

    let incompleteEvents: any[] = [];
    let completedEvents: any[] = [];

    if (allEventIds.length > 0) {
      // Incomplete events
      const { data: events } = await supabase
        .from("events")
        .select("name, status, start_date, end_date, projects(title)")
        .in("id", allEventIds)
        .in("status", ["pending", "in_progress", "planning", "preparation"]);
      incompleteEvents = events || [];

      // Completed events yesterday
      const { data: doneEvents } = await supabase
        .from("events")
        .select("name, status, start_date, end_date, projects(title)")
        .in("id", allEventIds)
        .eq("status", "completed")
        .eq("end_date", yesterdayStr);
      completedEvents = doneEvents || [];
    }

    // Combine all completed items
    const allCompletedTasks = [...(completedTasks || []), ...additionalCompletedTasks];
    const uniqueCompleted = allCompletedTasks.filter((task, index, self) =>
      index === self.findIndex((t) => t.title === task.title)
    );

    const completedItems: TaskItem[] = [
      ...uniqueCompleted.map((t: any) => ({
        title: t.title,
        type: 'task' as const,
        project: t.projects?.title,
      })),
      ...completedMeetings.map((m: any) => ({
        title: m.title,
        type: 'meeting' as const,
        deadline: m.meeting_date,
        project: m.projects?.title,
      })),
      ...completedShootings.map((s: any) => ({
        title: s.title,
        type: 'shooting' as const,
        deadline: s.scheduled_date,
        project: s.projects?.title,
      })),
      ...completedEvents.map((e: any) => ({
        title: e.name,
        type: 'event' as const,
        deadline: e.end_date,
        project: e.projects?.title,
      })),
    ];

    // Combine all incomplete items
    const allIncompleteTasks = [...(incompleteTasks || []), ...additionalIncompleteTasks];
    const uniqueIncomplete = allIncompleteTasks.filter((task, index, self) =>
      index === self.findIndex((t) => t.title === task.title)
    );

    const incompleteItems: TaskItem[] = [
      ...uniqueIncomplete.map((t: any) => ({
        title: t.title,
        type: 'task' as const,
        deadline: t.deadline,
        status: t.status,
        project: t.projects?.title,
      })),
      ...incompleteMeetings.map((m: any) => ({
        title: m.title,
        type: 'meeting' as const,
        deadline: m.meeting_date,
        status: m.status,
        project: m.projects?.title,
      })),
      ...incompleteShootings.map((s: any) => ({
        title: s.title,
        type: 'shooting' as const,
        deadline: s.scheduled_date,
        status: s.status,
        project: s.projects?.title,
      })),
      ...incompleteEvents.map((e: any) => ({
        title: e.name,
        type: 'event' as const,
        deadline: e.start_date,
        status: e.status,
        project: e.projects?.title,
      })),
    ];

    // Sort incomplete by deadline
    incompleteItems.sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    console.log(`Found ${completedItems.length} completed items, ${incompleteItems.length} incomplete items`);

    // Build email HTML
    const emailHtml = buildSummaryEmail(firstName, completedItems, incompleteItems, todayStr);

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
        subject: `Hi ${firstName}, ini ringkasan kerjaan kamu 👋`,
        html: emailHtml,
      }),
    });

    const emailResult = await response.json();
    console.log("Email send result:", JSON.stringify(emailResult, null, 2));

    if (!response.ok) {
      console.error("Failed to send email:", emailResult);
      // Don't throw - we don't want to block clock-in
      return new Response(
        JSON.stringify({ success: false, error: emailResult.message || "Email failed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the email
    await supabase.from("email_logs").insert({
      recipient_email: userEmail,
      recipient_name: userName,
      subject: `Hi ${firstName}, ini ringkasan kerjaan kamu 👋`,
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
    // Return success anyway - don't block clock-in
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function buildSummaryEmail(
  firstName: string,
  completedItems: TaskItem[],
  incompleteItems: TaskItem[],
  todayStr: string
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
      default: return '#6b7280';
    }
  };

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date(todayStr);
  };

  let completedSection = '';
  if (completedItems.length > 0) {
    completedSection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #16a34a; font-size: 16px; margin: 0 0 12px 0;">✅ Selesai Kemarin (${completedItems.length})</h3>
        <div style="background-color: #f0fdf4; border-radius: 8px; padding: 12px;">
          ${completedItems.map(item => `
            <div style="display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #dcfce7;">
              <span style="margin-right: 8px;">${getTypeIcon(item.type)}</span>
              <div>
                <span style="color: #333; font-weight: 500;">${item.title}</span>
                <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">(${getTypeLabel(item.type)})</span>
                ${item.project ? `<span style="color: #9ca3af; font-size: 12px; display: block;">${item.project}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    completedSection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #16a34a; font-size: 16px; margin: 0 0 12px 0;">✅ Selesai Kemarin</h3>
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; color: #6b7280;">
          Tidak ada pekerjaan yang selesai kemarin. Semangat hari ini! 💪
        </div>
      </div>
    `;
  }

  let incompleteSection = '';
  if (incompleteItems.length > 0) {
    incompleteSection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #f59e0b; font-size: 16px; margin: 0 0 12px 0;">📝 Belum Selesai (${incompleteItems.length})</h3>
        <div style="background-color: #fffbeb; border-radius: 8px; padding: 12px;">
          ${incompleteItems.map(item => `
            <div style="padding: 10px 0; border-bottom: 1px solid #fef3c7;">
              <div style="display: flex; align-items: center;">
                <span style="margin-right: 8px;">${getTypeIcon(item.type)}</span>
                <div style="flex: 1;">
                  <span style="color: #333; font-weight: 500;">${item.title}</span>
                  <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">(${getTypeLabel(item.type)})</span>
                  ${item.project ? `<span style="color: #9ca3af; font-size: 12px; display: block;">${item.project}</span>` : ''}
                </div>
              </div>
              <div style="display: flex; gap: 12px; margin-top: 6px; margin-left: 28px;">
                ${item.deadline ? `
                  <span style="font-size: 12px; color: ${isOverdue(item.deadline) ? '#ef4444' : '#6b7280'};">
                    📅 ${formatDate(item.deadline)} ${isOverdue(item.deadline) ? '⚠️ Overdue' : ''}
                  </span>
                ` : ''}
                ${item.status ? `
                  <span style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background-color: ${getStatusColor(item.status)}20; color: ${getStatusColor(item.status)};">
                    ${item.status.replace('_', ' ')}
                  </span>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    incompleteSection = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #f59e0b; font-size: 16px; margin: 0 0 12px 0;">📝 Belum Selesai</h3>
        <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center; color: #16a34a;">
          🎉 Semua pekerjaan sudah selesai! Keren banget!
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
      <title>Ringkasan Kerjaan - Talco System</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Talco System</h1>
        </div>
        
        <p style="font-size: 18px; color: #333;">Halo ${firstName} 👋</p>
        
        <p style="color: #555; font-size: 16px;">
          Selamat pagi! Ini ringkasan kerjaan kamu untuk hari ini:
        </p>
        
        ${completedSection}
        ${incompleteSection}
        
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
          Dikirim 1x per hari untuk bantu kamu tracking kerjaan.
        </p>
      </div>
    </body>
    </html>
  `;
}
