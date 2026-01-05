import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FolderOpen, CheckCircle2, Clock, ExternalLink } from "lucide-react";

interface ClientProjectTaskSectionProps {
  clientId: string;
  client: any;
  canEdit: boolean;
}

export function ClientProjectTaskSection({ clientId, client, canEdit }: ClientProjectTaskSectionProps) {
  const navigate = useNavigate();

  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles:profiles!fk_projects_assigned_to(full_name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks, isLoading: loadingTasks } = useQuery({
    queryKey: ["client-all-tasks", clientId],
    queryFn: async () => {
      if (!projects || projects.length === 0) return [];
      const projectIds = projects.map(p => p.id);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .in("project_id", projectIds);
      if (error) throw error;
      return data;
    },
    enabled: !!projects && projects.length > 0,
  });

  const totalProjects = projects?.length || 0;
  const completedProjects = projects?.filter(p => p.status === "completed").length || 0;
  const inProgressProjects = projects?.filter(p => p.status === "in_progress").length || 0;

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter(t => t.status === "completed").length || 0;
  const inProgressTasks = tasks?.filter(t => t.status === "in_progress").length || 0;
  const pendingTasks = tasks?.filter(t => t.status === "pending").length || 0;

  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      in_progress: { variant: "default", label: "In Progress" },
      completed: { variant: "secondary", label: "Completed" },
      on_hold: { variant: "destructive", label: "On Hold" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const isLoading = loadingProjects || loadingTasks;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalProjects}</p>
                <p className="text-xs text-muted-foreground">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedProjects}</p>
                <p className="text-xs text-muted-foreground">Completed Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTasks}</p>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressTasks}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Task Completion</span>
          <span>{completedTasks} / {totalTasks} tasks ({taskProgress.toFixed(0)}%)</span>
        </div>
        <Progress value={taskProgress} className="h-2" />
      </div>

      {/* Quick Links */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/projects?client=${clientId}`)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Lihat Semua Project
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/tasks?client=${clientId}`)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Lihat Semua Task
        </Button>
      </div>

      {/* Recent Projects */}
      <div>
        <h4 className="font-medium mb-3">Recent Projects</h4>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : projects && projects.length > 0 ? (
          <div className="space-y-2">
            {projects.slice(0, 5).map((project) => {
              const projectTasks = tasks?.filter(t => t.project_id === project.id) || [];
              const projectCompleted = projectTasks.filter(t => t.status === "completed").length;
              const projectTotal = projectTasks.length;
              const projectProgress = projectTotal > 0 ? (projectCompleted / projectTotal) * 100 : 0;

              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{project.title}</p>
                      {getStatusBadge(project.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {projectCompleted}/{projectTotal} tasks
                      </span>
                      {project.profiles && (
                        <span className="text-xs text-muted-foreground">
                          PIC: {project.profiles.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-24 ml-4">
                    <Progress value={projectProgress} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Belum ada project</p>
          </div>
        )}
      </div>
    </div>
  );
}
