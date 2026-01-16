import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClockInOut } from "@/components/attendance/ClockInOut";
import { ShootingNotifications } from "@/components/shooting/ShootingNotifications";
import { DeletionNotifications } from "@/components/hr/DeletionNotifications";
import { MeetingInvitationNotifications } from "@/components/meeting/MeetingInvitationNotifications";
import { AnnouncementNotifications } from "@/components/announcements/AnnouncementNotifications";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import HolidayBanner from "@/components/holiday/HolidayBanner";
import { Badge } from "@/components/ui/badge";
import { Users, FolderKanban, ArrowDownToLine, ArrowUpFromLine, ChevronRight, AlertTriangle } from "lucide-react";
import { isPast, parseISO } from "date-fns";

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

const isTaskOverdue = (task: any) => {
  if (!task.deadline) return false;
  if (task.status === 'completed' || task.status === 'done') return false;
  return isPast(parseISO(task.deadline));
};

export default function Index() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { data: session } = useQuery({
    queryKey: ["current-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id)
        .single();
      
      return data?.role;
    },
  });

  const isHR = userRole === "hr" || userRole === "super_admin";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clientsRes, projectsRes, tasksRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("client_type", "client").eq("status", "active"),
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
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Talco Creative Indonesia</h1>
          <p className="text-muted-foreground text-sm sm:text-base truncate">Management System - Overview</p>
        </div>

        <HolidayBanner />

        <ClockInOut />

        <AnnouncementNotifications />

        <MeetingInvitationNotifications />

        <ShootingNotifications />

        {isHR && <DeletionNotifications />}

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.clients || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats?.projects || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Tasks to Me</CardTitle>
              <ArrowDownToLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{tasksAssignedToMe?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Tasks I Gave</CardTitle>
              <ArrowUpFromLine className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{tasksAssignedByMe?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <ArrowDownToLine className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">Tasks Assigned to Me</span>
                {tasksAssignedToMe && tasksAssignedToMe.length > 0 && (
                  <Badge variant="secondary" className="flex-shrink-0">{tasksAssignedToMe.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {tasksAssignedToMe && tasksAssignedToMe.length > 0 ? (
                <div className="space-y-2 sm:space-y-3 max-h-[50vh] overflow-y-auto">
                  {tasksAssignedToMe.map((task: any) => (
                    <div 
                      key={task.id} 
                      className={`p-2.5 sm:p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group ${isTaskOverdue(task) ? 'border-destructive/50 bg-destructive/5' : ''}`}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <p className="font-medium text-sm sm:text-base truncate">{task.title}</p>
                            {isTaskOverdue(task) && (
                              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {task.projects?.clients?.name} - {task.projects?.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
                            From: {task.created_by_profile?.full_name || "Unknown"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <Badge className={`${getStatusColor(task.status)} text-xs`}>
                            {statusLabels[task.status] || task.status}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 sm:gap-4 mt-1.5 sm:mt-2 text-xs text-muted-foreground">
                        <span className="hidden sm:inline">Requested: {formatDate(task.requested_at)}</span>
                        <span className={isTaskOverdue(task) ? 'text-destructive font-medium' : ''}>
                          Due: {formatDate(task.deadline)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4 text-sm">No tasks assigned to you</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <ArrowUpFromLine className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">Tasks I Assigned</span>
                {tasksAssignedByMe && tasksAssignedByMe.length > 0 && (
                  <Badge variant="secondary" className="flex-shrink-0">{tasksAssignedByMe.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {tasksAssignedByMe && tasksAssignedByMe.length > 0 ? (
                <div className="space-y-2 sm:space-y-3 max-h-[50vh] overflow-y-auto">
                  {tasksAssignedByMe.map((task: any) => (
                    <div 
                      key={task.id} 
                      className={`p-2.5 sm:p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group ${isTaskOverdue(task) ? 'border-destructive/50 bg-destructive/5' : ''}`}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <p className="font-medium text-sm sm:text-base truncate">{task.title}</p>
                            {isTaskOverdue(task) && (
                              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {task.projects?.clients?.name} - {task.projects?.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
                            To: {task.assigned_profile?.full_name || "Unassigned"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <Badge className={`${getStatusColor(task.status)} text-xs`}>
                            {statusLabels[task.status] || task.status}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 sm:gap-4 mt-1.5 sm:mt-2 text-xs text-muted-foreground">
                        <span className="hidden sm:inline">Requested: {formatDate(task.requested_at)}</span>
                        <span className={isTaskOverdue(task) ? 'text-destructive font-medium' : ''}>
                          Due: {formatDate(task.deadline)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4 text-sm">No tasks assigned by you</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </AppLayout>
  );
}