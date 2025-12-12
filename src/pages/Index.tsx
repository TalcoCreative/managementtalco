import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClockInOut } from "@/components/attendance/ClockInOut";
import { ShootingNotifications } from "@/components/shooting/ShootingNotifications";
import { Badge } from "@/components/ui/badge";
import { Users, Briefcase, FolderKanban, Calendar, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
  revise: "Revise",
  todo: "To Do",
  done: "Done",
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
    case "done":
      return "bg-green-500";
    case "in_progress":
      return "bg-blue-500";
    case "pending":
    case "todo":
      return "bg-yellow-500";
    case "on_hold":
      return "bg-gray-500";
    case "revise":
      return "bg-red-500";
    default:
      return "bg-muted";
  }
};

export default function Index() {
  const { data: session } = useQuery({
    queryKey: ["current-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clientsRes, projectsRes, tasksRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
      ]);

      return {
        clients: clientsRes.count || 0,
        projects: projectsRes.count || 0,
        tasks: tasksRes.count || 0,
      };
    },
  });

  // Tasks assigned TO me (from others)
  const { data: tasksAssignedToMe } = useQuery({
    queryKey: ["tasks-assigned-to-me", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title, clients(name)), created_by_profile:profiles!fk_tasks_created_by_profiles(full_name)")
        .eq("assigned_to", session.user.id)
        .not("status", "in", "(completed,done)")
        .order("deadline", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  // Tasks assigned BY me (to others)
  const { data: tasksAssignedByMe } = useQuery({
    queryKey: ["tasks-assigned-by-me", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title, clients(name)), assigned_profile:profiles!fk_tasks_assigned_to_profiles(full_name)")
        .eq("created_by", session.user.id)
        .neq("assigned_to", session.user.id)
        .not("status", "in", "(completed,done)")
        .order("deadline", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your projects and tasks</p>
        </div>

        <ClockInOut />

        <ShootingNotifications />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.clients || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.projects || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tasks Assigned to Me</CardTitle>
              <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksAssignedToMe?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tasks I Assigned</CardTitle>
              <ArrowUpFromLine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasksAssignedByMe?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tasks Assigned TO Me */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" />
                Tasks Assigned to Me
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksAssignedToMe && tasksAssignedToMe.length > 0 ? (
                <div className="space-y-3">
                  {tasksAssignedToMe.map((task: any) => (
                    <div key={task.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.projects?.clients?.name} - {task.projects?.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            From: {task.created_by_profile?.full_name || "Unknown"}
                          </p>
                        </div>
                        <Badge className={getStatusColor(task.status)}>
                          {statusLabels[task.status] || task.status}
                        </Badge>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Requested: {formatDate(task.requested_at)}</span>
                        <span>Deadline: {formatDate(task.deadline)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No tasks assigned to you</p>
              )}
            </CardContent>
          </Card>

          {/* Tasks Assigned BY Me */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpFromLine className="h-5 w-5" />
                Tasks I Assigned to Others
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksAssignedByMe && tasksAssignedByMe.length > 0 ? (
                <div className="space-y-3">
                  {tasksAssignedByMe.map((task: any) => (
                    <div key={task.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.projects?.clients?.name} - {task.projects?.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Assigned to: {task.assigned_profile?.full_name || "Unassigned"}
                          </p>
                        </div>
                        <Badge className={getStatusColor(task.status)}>
                          {statusLabels[task.status] || task.status}
                        </Badge>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Requested: {formatDate(task.requested_at)}</span>
                        <span>Deadline: {formatDate(task.deadline)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No tasks assigned by you</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}