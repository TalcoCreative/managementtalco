import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Timer, ArrowRight, TrendingUp, Zap } from "lucide-react";

interface StatusLog {
  id: string;
  task_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
}

interface TaskDurationAnalyticsProps {
  statusLogs: StatusLog[];
  tasks: any[];
  profiles: any[];
  title?: string;
  showPerEmployee?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  on_hold: "On Hold",
  revise: "Revise",
  completed: "Completed",
  done: "Done",
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
};

export function TaskDurationAnalytics({ statusLogs, tasks, profiles, title, showPerEmployee = false }: TaskDurationAnalyticsProps) {
  // Calculate transition durations
  const transitionStats = useMemo(() => {
    // Group logs by task, sorted by time
    const logsByTask = new Map<string, StatusLog[]>();
    statusLogs.forEach(log => {
      const existing = logsByTask.get(log.task_id) || [];
      existing.push(log);
      logsByTask.set(log.task_id, existing);
    });

    // Sort each task's logs by time
    logsByTask.forEach((logs, taskId) => {
      logs.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
    });

    // Calculate time spent in each status per task
    const statusDurations: { taskId: string; status: string; durationMinutes: number; assignedTo: string | null }[] = [];
    const transitionTimes: { from: string; to: string; durationMinutes: number }[] = [];

    logsByTask.forEach((logs, taskId) => {
      const task = tasks.find(t => t.id === taskId);
      const assignedTo = task?.assigned_to || null;

      for (let i = 0; i < logs.length; i++) {
        const current = logs[i];
        const next = logs[i + 1];

        if (next) {
          const duration = (new Date(next.changed_at).getTime() - new Date(current.changed_at).getTime()) / 60000;
          statusDurations.push({
            taskId,
            status: current.new_status,
            durationMinutes: duration,
            assignedTo,
          });

          transitionTimes.push({
            from: current.new_status,
            to: next.new_status,
            durationMinutes: duration,
          });
        }
      }
    });

    // Calculate averages per status
    const statusAvg = new Map<string, { total: number; count: number }>();
    statusDurations.forEach(d => {
      const existing = statusAvg.get(d.status) || { total: 0, count: 0 };
      existing.total += d.durationMinutes;
      existing.count++;
      statusAvg.set(d.status, existing);
    });

    // Calculate averages per transition
    const transitionAvg = new Map<string, { total: number; count: number }>();
    transitionTimes.forEach(t => {
      const key = `${t.from} → ${t.to}`;
      const existing = transitionAvg.get(key) || { total: 0, count: 0 };
      existing.total += t.durationMinutes;
      existing.count++;
      transitionAvg.set(key, existing);
    });

    // Per-employee stats
    const employeeStats = new Map<string, { totalMinutes: number; taskCount: number; completedCount: number; avgMinutes: number }>();
    if (showPerEmployee) {
      const taskDurations = new Map<string, { assignedTo: string; totalMinutes: number; isCompleted: boolean }>();
      
      logsByTask.forEach((logs, taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task?.assigned_to) return;
        
        const firstLog = logs[0];
        const lastLog = logs[logs.length - 1];
        const totalMinutes = (new Date(lastLog.changed_at).getTime() - new Date(firstLog.changed_at).getTime()) / 60000;
        const isCompleted = lastLog.new_status === 'completed' || lastLog.new_status === 'done';
        
        taskDurations.set(taskId, { assignedTo: task.assigned_to, totalMinutes, isCompleted });
      });

      taskDurations.forEach(({ assignedTo, totalMinutes, isCompleted }) => {
        const existing = employeeStats.get(assignedTo) || { totalMinutes: 0, taskCount: 0, completedCount: 0, avgMinutes: 0 };
        existing.totalMinutes += totalMinutes;
        existing.taskCount++;
        if (isCompleted) existing.completedCount++;
        employeeStats.set(assignedTo, existing);
      });

      employeeStats.forEach((stats, userId) => {
        stats.avgMinutes = stats.taskCount > 0 ? stats.totalMinutes / stats.taskCount : 0;
      });
    }

    // Overall average: pending to completed
    let avgPendingToComplete = 0;
    let completedCount = 0;
    logsByTask.forEach((logs) => {
      const firstLog = logs[0];
      const lastLog = logs[logs.length - 1];
      if (lastLog.new_status === 'completed' || lastLog.new_status === 'done') {
        const duration = (new Date(lastLog.changed_at).getTime() - new Date(firstLog.changed_at).getTime()) / 60000;
        avgPendingToComplete += duration;
        completedCount++;
      }
    });
    avgPendingToComplete = completedCount > 0 ? avgPendingToComplete / completedCount : 0;

    return {
      statusAvg: Array.from(statusAvg.entries()).map(([status, data]) => ({
        status,
        avgMinutes: data.total / data.count,
        count: data.count,
      })).sort((a, b) => b.count - a.count),
      transitionAvg: Array.from(transitionAvg.entries()).map(([key, data]) => ({
        transition: key,
        avgMinutes: data.total / data.count,
        count: data.count,
      })).sort((a, b) => b.count - a.count),
      employeeStats: Array.from(employeeStats.entries()).map(([userId, stats]) => ({
        userId,
        ...stats,
        name: profiles.find(p => p.id === userId)?.full_name || 'Unknown',
      })).sort((a, b) => a.avgMinutes - b.avgMinutes),
      avgPendingToComplete,
      completedCount,
      totalTrackedTasks: logsByTask.size,
    };
  }, [statusLogs, tasks, profiles, showPerEmployee]);

  if (statusLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            {title || "Task Duration Analytics"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Belum ada data perubahan status. Data akan muncul setelah status task diubah.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Penyelesaian Task</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transitionStats.completedCount > 0 ? formatDuration(transitionStats.avgPendingToComplete) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Dari {transitionStats.completedCount} task completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Task Dilacak</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transitionStats.totalTrackedTasks}</div>
            <p className="text-xs text-muted-foreground">Task dengan perubahan status</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Transisi</CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusLogs.length}</div>
            <p className="text-xs text-muted-foreground">Perubahan status tercatat</p>
          </CardContent>
        </Card>
      </div>

      {/* Average Time per Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-5 w-5" />
            Rata-rata Waktu di Setiap Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rata-rata Durasi</TableHead>
                <TableHead className="text-right">Jumlah Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transitionStats.statusAvg.map(row => (
                <TableRow key={row.status}>
                  <TableCell>
                    <Badge variant="outline">{STATUS_LABELS[row.status] || row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatDuration(row.avgMinutes)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transition Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRight className="h-5 w-5" />
            Rata-rata Waktu Perpindahan Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transisi</TableHead>
                <TableHead className="text-right">Rata-rata Durasi</TableHead>
                <TableHead className="text-right">Frekuensi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transitionStats.transitionAvg.slice(0, 15).map(row => {
                const [from, to] = row.transition.split(' → ');
                return (
                  <TableRow key={row.transition}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs">{STATUS_LABELS[from] || from}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Badge variant="outline" className="text-xs">{STATUS_LABELS[to] || to}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatDuration(row.avgMinutes)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.count}x</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per Employee Breakdown */}
      {showPerEmployee && transitionStats.employeeStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5" />
              Rata-rata Durasi Penyelesaian Per Karyawan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead className="text-right">Avg. Durasi/Task</TableHead>
                  <TableHead className="text-right">Task Dilacak</TableHead>
                  <TableHead className="text-right">Task Selesai</TableHead>
                  <TableHead className="text-right">Total Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transitionStats.employeeStats.map(emp => (
                  <TableRow key={emp.userId}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatDuration(emp.avgMinutes)}
                    </TableCell>
                    <TableCell className="text-right">{emp.taskCount}</TableCell>
                    <TableCell className="text-right">{emp.completedCount}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDuration(emp.totalMinutes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
