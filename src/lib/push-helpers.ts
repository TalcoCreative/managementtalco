import { supabase } from "@/integrations/supabase/client";
import { sendWebPush } from "@/lib/push-utils";

/**
 * Get all involved user IDs for a task (assignees, creator, watchers)
 */
export async function getTaskInvolvedUsers(taskId: string): Promise<string[]> {
  const userIds = new Set<string>();

  // Get task creator
  const { data: task } = await supabase
    .from("tasks")
    .select("created_by")
    .eq("id", taskId)
    .single();
  if (task?.created_by) userIds.add(task.created_by);

  // Get assignees
  const { data: assignees } = await supabase
    .from("task_assignees")
    .select("user_id")
    .eq("task_id", taskId);
  assignees?.forEach(a => userIds.add(a.user_id));

  // Get watchers
  const { data: watchers } = await supabase
    .from("task_watchers")
    .select("user_id")
    .eq("task_id", taskId);
  watchers?.forEach(w => userIds.add(w.user_id));

  return Array.from(userIds);
}

/**
 * Send push notification to all involved task users (excluding current user)
 */
export async function pushToTaskInvolved(params: {
  taskId: string;
  title: string;
  body: string;
  tag: string;
  excludeUserId?: string;
}) {
  const allUsers = await getTaskInvolvedUsers(params.taskId);
  const targetUsers = params.excludeUserId
    ? allUsers.filter(id => id !== params.excludeUserId)
    : allUsers;

  if (targetUsers.length > 0) {
    await sendWebPush({
      userIds: targetUsers,
      title: params.title,
      body: params.body,
      url: "/tasks",
      tag: params.tag,
    });
  }
}

/**
 * Get all crew user IDs for a shooting (director, runner, campers, additional)
 */
export async function getShootingInvolvedUsers(shootingId: string): Promise<string[]> {
  const userIds = new Set<string>();

  // Get shooting director/runner/requested_by
  const { data: shooting } = await supabase
    .from("shooting_schedules")
    .select("director, runner, requested_by")
    .eq("id", shootingId)
    .single();
  if (shooting?.director) userIds.add(shooting.director);
  if (shooting?.runner) userIds.add(shooting.runner);
  if (shooting?.requested_by) userIds.add(shooting.requested_by);

  // Get crew
  const { data: crew } = await supabase
    .from("shooting_crew")
    .select("user_id")
    .eq("shooting_id", shootingId)
    .not("user_id", "is", null);
  crew?.forEach(c => { if (c.user_id) userIds.add(c.user_id); });

  return Array.from(userIds);
}

/**
 * Send push notification to all shooting crew (excluding current user)
 */
export async function pushToShootingInvolved(params: {
  shootingId: string;
  title: string;
  body: string;
  tag: string;
  excludeUserId?: string;
}) {
  const allUsers = await getShootingInvolvedUsers(params.shootingId);
  const targetUsers = params.excludeUserId
    ? allUsers.filter(id => id !== params.excludeUserId)
    : allUsers;

  if (targetUsers.length > 0) {
    await sendWebPush({
      userIds: targetUsers,
      title: params.title,
      body: params.body,
      url: "/shooting",
      tag: params.tag,
    });
  }
}

/**
 * Get all HR, Finance, and Super Admin user IDs
 */
export async function getHRFinanceAdminUsers(): Promise<string[]> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["hr", "super_admin"]);
  
  const userIds = new Set<string>();
  roles?.forEach(r => userIds.add(r.user_id));

  // Also check dynamic roles for finance permission
  const { data: dynamicUsers } = await supabase
    .from("user_dynamic_roles")
    .select("user_id, dynamic_roles!inner(name)")
    .or("dynamic_roles.name.ilike.%finance%,dynamic_roles.name.ilike.%accounting%");
  
  dynamicUsers?.forEach((r: any) => userIds.add(r.user_id));

  return Array.from(userIds);
}

/**
 * Get all meeting participant user IDs
 */
export async function getMeetingInvolvedUsers(meetingId: string): Promise<string[]> {
  const userIds = new Set<string>();

  // Get meeting creator
  const { data: meeting } = await supabase
    .from("meetings")
    .select("created_by")
    .eq("id", meetingId)
    .single();
  if (meeting?.created_by) userIds.add(meeting.created_by);

  // Get all participants
  const { data: participants } = await supabase
    .from("meeting_participants")
    .select("user_id")
    .eq("meeting_id", meetingId);
  participants?.forEach(p => userIds.add(p.user_id));

  return Array.from(userIds);
}
