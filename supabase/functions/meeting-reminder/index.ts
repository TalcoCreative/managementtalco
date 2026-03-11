import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get meetings starting in the next 25-35 minutes (to handle cron interval)
    const now = new Date();
    const from25min = new Date(now.getTime() + 25 * 60 * 1000);
    const to35min = new Date(now.getTime() + 35 * 60 * 1000);

    // Get today's date in Jakarta timezone
    const jakartaOffset = 7 * 60 * 60 * 1000;
    const jakartaNow = new Date(now.getTime() + jakartaOffset);
    const todayStr = jakartaNow.toISOString().split("T")[0];

    // Get meetings happening today that haven't been reminded yet
    const { data: meetings, error: meetError } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, start_time, location, mode, meeting_link")
      .eq("meeting_date", todayStr)
      .in("status", ["scheduled", "in_progress"])
      .is("reminder_sent", null);

    if (meetError) {
      console.error("Error fetching meetings:", meetError);
      return new Response(JSON.stringify({ error: meetError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!meetings || meetings.length === 0) {
      return new Response(JSON.stringify({ message: "No meetings to remind", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter meetings starting in ~30 minutes
    const meetingsToRemind = meetings.filter((m) => {
      if (!m.start_time) return false;
      const [hours, minutes] = m.start_time.split(":").map(Number);
      const meetingTime = new Date(`${m.meeting_date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+07:00`);
      return meetingTime >= from25min && meetingTime <= to35min;
    });

    if (meetingsToRemind.length === 0) {
      return new Response(JSON.stringify({ message: "No meetings in 30-min window", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get VAPID keys
    const { data: vapidPublic } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("setting_key", "vapid_public_key")
      .single();
    const { data: vapidPrivate } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("setting_key", "vapid_private_key")
      .single();

    if (!vapidPublic?.setting_value || !vapidPrivate?.setting_value) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(
      "mailto:admin@talco.id",
      vapidPublic.setting_value,
      vapidPrivate.setting_value
    );

    let totalSent = 0;

    for (const meeting of meetingsToRemind) {
      // Get all participants
      const { data: participants } = await supabase
        .from("meeting_participants")
        .select("user_id")
        .eq("meeting_id", meeting.id);

      // Also include creator
      const { data: meetingFull } = await supabase
        .from("meetings")
        .select("created_by")
        .eq("id", meeting.id)
        .single();

      const userIds = new Set<string>();
      participants?.forEach((p) => userIds.add(p.user_id));
      if (meetingFull?.created_by) userIds.add(meetingFull.created_by);

      if (userIds.size === 0) continue;

      // Get subscriptions for all users
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("user_id", Array.from(userIds))
        .eq("is_active", true);

      if (!subscriptions || subscriptions.length === 0) continue;

      const locationInfo = meeting.is_online
        ? `Online${meeting.meeting_link ? "" : ""}`
        : meeting.location || "TBD";

      const payload = JSON.stringify({
        title: "Talco - Meeting in 30 Minutes ⏰",
        body: `"${meeting.title}" starts at ${meeting.start_time?.slice(0, 5)} - ${locationInfo}`,
        url: "/meeting",
        tag: `meeting-reminder-${meeting.id}`,
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
            },
            payload
          );
          totalSent++;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", sub.id);
          }
          console.error(`Push failed for ${sub.endpoint}:`, err.message);
        }
      }

      // Mark meeting as reminded
      await supabase
        .from("meetings")
        .update({ reminder_sent: true })
        .eq("id", meeting.id);

      // Log
      await supabase.from("push_notification_logs").insert({
        target_user_ids: Array.from(userIds),
        title: "Meeting Reminder",
        body: `"${meeting.title}" in 30 minutes`,
        status: totalSent > 0 ? "sent" : "no_subscribers",
        sent_count: totalSent,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        meetings_reminded: meetingsToRemind.length,
        push_sent: totalSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
