import { parseISO } from "date-fns";

/**
 * Returns the earliest completion timestamp (as Date) for a task based on
 * task_status_logs. Returns null if no completion log is found in the provided
 * set. Note: if logs are pre-filtered by a date window, completions outside
 * that window will be unknown to this helper.
 */
export function getTaskCompletedAt(
  taskId: string,
  statusLogs: Array<{ task_id: string; new_status: string; changed_at: string }>,
): Date | null {
  const completionLogs = statusLogs
    .filter(
      (l) =>
        l.task_id === taskId &&
        (l.new_status === "done" || l.new_status === "completed"),
    )
    .map((l) => parseISO(l.changed_at))
    .sort((a, b) => a.getTime() - b.getTime());
  return completionLogs[0] ?? null;
}

/**
 * Determines whether a task should be counted as "overdue" within the given
 * window. Logic:
 *  - Ongoing tasks: their deadline falls inside the window AND is already in
 *    the past (i.e. truly overdue right now).
 *  - Completed tasks: they were completed LATE (completion timestamp after
 *    deadline) AND that completion happened inside the window.
 *
 * This avoids the bug where viewing a past month would only count tasks that
 * are still ongoing today, ignoring everything that was completed late during
 * that period.
 */
export function isTaskOverdueInRange(
  task: { id: string; status: string; deadline: string | null },
  statusLogs: Array<{ task_id: string; new_status: string; changed_at: string }>,
  startDate: string | Date,
  endDate: string | Date,
): boolean {
  if (!task.deadline) return false;
  const deadline = parseISO(
    typeof task.deadline === "string" && task.deadline.length === 10
      ? `${task.deadline}T23:59:59`
      : task.deadline,
  );
  const start = typeof startDate === "string" ? parseISO(`${startDate}T00:00:00`) : startDate;
  const end = typeof endDate === "string" ? parseISO(`${endDate}T23:59:59`) : endDate;

  const isCompleted = task.status === "done" || task.status === "completed";

  if (isCompleted) {
    const completedAt = getTaskCompletedAt(task.id, statusLogs);
    if (!completedAt) return false; // unknown completion time → cannot attribute
    return (
      completedAt.getTime() > deadline.getTime() &&
      completedAt >= start &&
      completedAt <= end
    );
  }

  // Ongoing: count if deadline is in window AND already past (truly overdue)
  const now = new Date();
  return deadline < now && deadline >= start && deadline <= end;
}

/**
 * Convenience: count overdue tasks for a list within the window.
 */
export function countOverdueInRange(
  tasks: Array<{ id: string; status: string; deadline: string | null }>,
  statusLogs: Array<{ task_id: string; new_status: string; changed_at: string }>,
  startDate: string | Date,
  endDate: string | Date,
): number {
  return tasks.filter((t) => isTaskOverdueInRange(t, statusLogs, startDate, endDate)).length;
}
