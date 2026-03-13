import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ClockInOut } from "@/components/attendance/ClockInOut";
import { ShootingNotifications } from "@/components/shooting/ShootingNotifications";
import { DeletionNotifications } from "@/components/hr/DeletionNotifications";
import { MeetingInvitationNotifications } from "@/components/meeting/MeetingInvitationNotifications";
import { AnnouncementNotifications } from "@/components/announcements/AnnouncementNotifications";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import HolidayBanner from "@/components/holiday/HolidayBanner";
import { TeamMoodBar } from "@/components/dashboard/TeamMoodBar";
import { MoodNudge } from "@/components/attendance/MoodNudge";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Users,
  FolderKanban,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  AlertTriangle,
  CheckSquare,
  Calendar,
  Camera,
  Video,
  Briefcase,
  FileText,
  DollarSign,
  BarChart3,
  Megaphone,
  Palette,
  TrendingUp,
} from "lucide-react";
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
      return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]";
    case "in_progress":
      return "bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]";
    case "pending":
    case "todo":
      return "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]";
    case "on_hold":
      return "bg-muted text-muted-foreground";
    case "revise":
      return "bg-destructive text-destructive-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const isTaskOverdue = (task: any) => {
  if (!task.deadline) return false;
  if (task.status === "completed" || task.status === "done") return false;
  return isPast(parseISO(task.deadline));
};

const quickModules = [
  { title: "Tasks", url: "/tasks", icon: CheckSquare, color: "hsl(var(--primary))", featureKey: "tasks" },
  { title: "Projects", url: "/projects", icon: Briefcase, color: "hsl(var(--info))", featureKey: "projects" },
  { title: "Schedule", url: "/schedule", icon: Calendar, color: "hsl(var(--warning))", featureKey: "schedule" },
  { title: "Shooting", url: "/shooting", icon: Camera, color: "hsl(152 48% 46%)", featureKey: "shooting" },
  { title: "Meeting", url: "/meeting", icon: Video, color: "hsl(280 60% 55%)", featureKey: "meeting" },
  { title: "Clients", url: "/clients", icon: Users, color: "hsl(var(--primary))", featureKey: "clients" },
  { title: "Finance", url: "/finance", icon: DollarSign, color: "hsl(152 48% 46%)", featureKey: "finance" },
  { title: "Reports", url: "/reports", icon: BarChart3, color: "hsl(var(--info))", featureKey: "reports" },
  { title: "Social Media", url: "/social-media", icon: Megaphone, color: "hsl(330 60% 55%)", featureKey: "social_media" },
  { title: "Sales", url: "/sales/dashboard", icon: TrendingUp, color: "hsl(var(--warning))", featureKey: "sales_analytics" },
  { title: "Editorial", url: "/editorial-plan", icon: Palette, color: "hsl(280 60% 55%)", featureKey: "editorial_plan" },
  { title: "Letters", url: "/letters", icon: FileText, color: "hsl(var(--muted-foreground))", featureKey: "letters" },
];

export default function Index() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { canView } = usePermissions();

  const { data: session } = useQuery({
    queryKey: ["current-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["current-profile", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
      return data;
    },
    enabled: !!session?.user?.id,
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
        supabase.from("projects").select("id", { count: "exact", head: true }).neq("status", "completed"),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
      ]);
      return {
        clients: clientsRes.count || 0,
        projects: projectsRes.count || 0,
        tasks: tasksRes.count || 0,
      };
    },
  });

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
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const visibleModules = quickModules.filter((m) => canView(m.featureKey));

  return (
    <AppLayout>
      <div className="space-y-5 sm:space-y-6">
        {/* Greeting + Team Mood */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-sm">{greeting} 👋</p>
            <h1 className="text-xl sm:text-2xl font-bold truncate">{firstName}</h1>
          </div>
          <TeamMoodBar />
        </div>

        <HolidayBanner />
        <ClockInOut />
        <AnnouncementNotifications />
        <MeetingInvitationNotifications />
        <ShootingNotifications />
        {isHR && <DeletionNotifications />}

        {/* Stats Row — Colorful KPI cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={<Users className="h-5 w-5" />} label="Clients" value={stats?.clients || 0} color="var(--section-clients)" />
          <KpiCard icon={<FolderKanban className="h-5 w-5" />} label="Active Projects" value={stats?.projects || 0} color="var(--section-projects)" />
          <KpiCard icon={<ArrowDownToLine className="h-5 w-5" />} label="Tasks to Me" value={tasksAssignedToMe?.length || 0} color="var(--section-tasks)" />
          <KpiCard icon={<ArrowUpFromLine className="h-5 w-5" />} label="Tasks I Gave" value={tasksAssignedByMe?.length || 0} color="var(--section-finance)" />
        </div>

        {/* Quick Access Modules — Colorful grid */}
        {visibleModules.length > 0 && (
          <div>
            <div className="section-divider">
              <span className="divider-label">Quick Access</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5 sm:gap-3">
              {visibleModules.map((mod) => (
                <button
                  key={mod.url}
                  onClick={() => navigate(mod.url)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card hover:bg-accent/60 transition-all duration-200 hover:shadow-soft-md hover:-translate-y-0.5 active:scale-[0.97] group"
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: `${mod.color}15`, boxShadow: `0 4px 12px ${mod.color}20` }}
                  >
                    <mod.icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" style={{ color: mod.color }} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-foreground/80 leading-tight text-center">
                    {mod.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Task Lists */}
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          <TaskSection
            icon={<ArrowDownToLine className="h-4 w-4 sm:h-5 sm:w-5" />}
            title="Assigned to Me"
            accentColor="var(--section-tasks)"
            tasks={tasksAssignedToMe || []}
            emptyText="No tasks assigned to you"
            getSubtext={(task: any) => `From: ${task.created_by_profile?.full_name || "Unknown"}`}
            onTaskClick={setSelectedTaskId}
            formatDate={formatDate}
          />
          <TaskSection
            icon={<ArrowUpFromLine className="h-4 w-4 sm:h-5 sm:w-5" />}
            title="Tasks I Assigned"
            accentColor="var(--section-finance)"
            tasks={tasksAssignedByMe || []}
            emptyText="No tasks assigned by you"
            getSubtext={(task: any) => `To: ${task.assigned_profile?.full_name || "Unassigned"}`}
            onTaskClick={setSelectedTaskId}
            formatDate={formatDate}
          />
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

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="kpi-card p-3.5 sm:p-4" style={{ '--kpi-color': color } as React.CSSProperties}>
      <div className="flex items-center gap-3">
        <div className="kpi-icon">{icon}</div>
        <div className="min-w-0">
          <p className="kpi-value leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}

function TaskSection({
  icon,
  title,
  accentColor,
  tasks,
  emptyText,
  getSubtext,
  onTaskClick,
  formatDate,
}: {
  icon: React.ReactNode;
  title: string;
  accentColor?: string;
  tasks: any[];
  emptyText: string;
  getSubtext: (task: any) => string;
  onTaskClick: (id: string) => void;
  formatDate: (d: string | null) => string;
}) {
  return (
    <Card className="border-0 shadow-float overflow-hidden card-accent" style={{ '--accent-color': accentColor || 'var(--primary)' } as React.CSSProperties}>
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div style={{ color: `hsl(${accentColor || 'var(--primary)'})` }}>{icon}</div>
          <h3 className="font-semibold text-sm sm:text-base">{title}</h3>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5 rounded-full">
              {tasks.length}
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="px-4 pb-4 pt-1">
        {tasks.length > 0 ? (
          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {tasks.map((task: any) => {
              const overdue = isTaskOverdue(task);
              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl transition-all duration-200 cursor-pointer group
                    ${overdue ? "bg-destructive/5 border border-destructive/20" : "bg-muted/30 hover:bg-accent/50"}
                    active:scale-[0.99]`}
                  onClick={() => onTaskClick(task.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {task.projects?.clients?.name} · {task.projects?.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">
                        {getSubtext(task)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={`${getStatusColor(task.status)} text-[10px] px-1.5 py-0 h-5 rounded-full`}>
                        {statusLabels[task.status] || task.status}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className={overdue ? "text-destructive font-medium" : ""}>
                      Due: {formatDate(task.deadline)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckSquare className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">{emptyText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
