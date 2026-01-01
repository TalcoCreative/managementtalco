import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Building2,
  User,
  CheckCircle2,
  Clock,
  Users,
  FolderOpen,
} from "lucide-react";
import { format } from "date-fns";

type SharedProjectPayload = {
  project: any;
  tasks: any[];
  team: string[];
};

export default function SharedProject() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-project-data", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");

      const { data, error } = await supabase.functions.invoke<SharedProjectPayload>(
        "shared-project",
        { body: { token } }
      );

      if (error) throw error;
      if (!data) throw new Error("Failed to load shared project");
      return data;
    },
    enabled: !!token,
  });

  const project = data?.project;
  const tasks = data?.tasks || [];
  const team = data?.team || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-blue-500";
      case "on_hold":
        return "bg-yellow-500";
      default:
        return "bg-muted";
    }
  };

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter((t: any) => t.status === "completed").length,
    inProgress: tasks.filter((t: any) => t.status === "in_progress").length,
    pending: tasks.filter((t: any) => t.status === "pending").length,
    completionRate:
      tasks.length > 0
        ? Math.round(
            (tasks.filter((t: any) => t.status === "completed").length /
              tasks.length) *
              100
          )
        : 0,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
            <p className="text-muted-foreground">
              This project link may have expired or is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">{project.title}</CardTitle>
                </div>
                <Badge className={getStatusColor(project.status)}>
                  {project.status?.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {project.clients?.name && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-medium">{project.clients.name}</p>
                  </div>
                </div>
              )}

              {project.profiles?.full_name && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Project Lead</p>
                    <p className="font-medium">{project.profiles.full_name}</p>
                  </div>
                </div>
              )}

              {project.deadline && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    <p className="font-medium">
                      {format(new Date(project.deadline), "PPP")}
                    </p>
                  </div>
                </div>
              )}

              {project.created_at && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {format(new Date(project.created_at), "PPP")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {project.description && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {project.description}
                  </p>
                </div>
              </>
            )}

            {/* Team Members */}
            {team.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Involved ({team.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {team.map((member, idx) => (
                      <Badge key={idx} variant="outline">
                        {member}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {taskStats.completed} of {taskStats.total} tasks completed
              </span>
              <span className="font-semibold">{taskStats.completionRate}%</span>
            </div>
            <Progress value={taskStats.completionRate} />

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {taskStats.pending}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {taskStats.inProgress}
                </div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {taskStats.completed}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Summary */}
        {tasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tasks Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      {task.deadline && (
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(task.deadline), "PPP")}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status?.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Shared via Talco Creative Indonesia
        </p>
      </div>
    </div>
  );
}
