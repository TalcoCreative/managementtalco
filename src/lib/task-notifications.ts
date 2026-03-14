import { supabase } from "@/integrations/supabase/client";
import { sendWebPush } from "@/lib/push-utils";
import { sendTaskStatusChangeEmail } from "@/lib/email-notifications";
import { sendWhatsApp } from "@/lib/whatsapp-utils";

/**
 * Shared utility: notify ALL involved users when a task status changes.
 * Sends bell notification, email, and push notification.
 * Use this from ANY place that changes task status.
 */
export async function notifyTaskStatusChange(taskId: string, newStatus: string) {
  try {
    const { data: session } = await supabase.auth.getSession();
    const currentUserId = session.session?.user.id;
    if (!currentUserId) return;

    // Get task data
    const { data: taskData } = await supabase
      .from("tasks")
      .select("title, assigned_to, created_by, share_token")
      .eq("id", taskId)
      .single();
    if (!taskData) return;

    // Get changer's name
    const { data: changerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", currentUserId)
      .single();

    // Collect ALL involved users
    const { data: multiAssignees } = await supabase
      .from("task_assignees")
      .select("user_id")
      .eq("task_id", taskId);
    const { data: watchers } = await supabase
      .from("task_watchers")
      .select("user_id")
      .eq("task_id", taskId);

    const notifyUsers = new Set<string>();
    if (taskData.assigned_to && taskData.assigned_to !== currentUserId) {
      notifyUsers.add(taskData.assigned_to);
    }
    if (taskData.created_by && taskData.created_by !== currentUserId) {
      notifyUsers.add(taskData.created_by);
    }
    multiAssignees?.forEach(a => { if (a.user_id !== currentUserId) notifyUsers.add(a.user_id); });
    watchers?.forEach(w => { if (w.user_id !== currentUserId) notifyUsers.add(w.user_id); });

    if (notifyUsers.size === 0) return;

    const changerName = changerProfile?.full_name || "Someone";
    const statusLabel = newStatus.replace(/_/g, " ");
    const targets = Array.from(notifyUsers);

    // 1. Bell notification (also triggers DB push backup)
    const bellRecords = targets.map(uid => ({
      task_id: taskId,
      user_id: uid,
      notification_type: "status_change",
      message: `${changerName} mengubah status "${taskData.title}" menjadi ${statusLabel}`,
      created_by: currentUserId,
    }));
    supabase.from("task_notifications").insert(bellRecords).then(({ error }) => {
      if (error) console.error("[TaskNotify] Bell insert failed:", error);
      else console.log("[TaskNotify] Bell notifications inserted for", targets.length, "users");
    });

    // 2. Email notification
    sendTaskStatusChangeEmail(targets, {
      id: taskId,
      title: taskData.title,
      newStatus,
      changerName,
      shareToken: taskData.share_token,
    }).catch(err => console.error("[TaskNotify] Email failed:", err));

    // 3. Direct push notification (immediate, not relying on DB trigger)
    console.log("[TaskNotify] Sending push to", targets.length, "users:", targets);
    sendWebPush({
      userIds: targets,
      title: "Talco - Task Status Changed",
      body: `${changerName} mengubah "${taskData.title}" → ${statusLabel}`,
      url: "/tasks",
      tag: `task-status-${taskId}-${Date.now()}`,
    }).catch(err => console.error("[TaskNotify] Push failed:", err));

    // 4. WhatsApp notification via Fonnte
    const waMessage = `Halo!\n\nTask "${taskData.title}" telah diubah statusnya menjadi *${statusLabel}* oleh ${changerName}.\n\nSilakan cek di Talco Project Management System.`;
    sendWhatsApp({
      userIds: targets,
      message: waMessage,
      eventType: "task_status_updated",
    }).catch(err => console.error("[TaskNotify] WhatsApp failed:", err));

  } catch (err) {
    console.error("[TaskNotify] Error:", err);
  }
}
