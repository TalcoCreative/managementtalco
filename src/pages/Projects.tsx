import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle, Clock } from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { toast } from "sonner";
import { isPast, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Projects() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", selectedClient],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*, clients(name), profiles(full_name)")
        .order("created_at", { ascending: false });

      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch overdue and today's tasks per project
  const { data: tasksByProject } = useQuery({
    queryKey: ["tasks-by-project-deadline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, project_id, deadline, status")
        .not("status", "in", "(completed,done)")
        .not("deadline", "is", null);
      if (error) throw error;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      // Group by project with overdue and today
      const byProject = new Map<string, { overdue: any[]; today: any[] }>();
      
      data?.forEach(task => {
        if (task.project_id && task.deadline) {
          const deadline = parseISO(task.deadline);
          const isOverdue = isPast(deadline) && deadline < today;
          const isToday = deadline >= today && deadline <= todayEnd;
          
          if (!byProject.has(task.project_id)) {
            byProject.set(task.project_id, { overdue: [], today: [] });
          }
          
          if (isOverdue) {
            byProject.get(task.project_id)!.overdue.push(task);
          } else if (isToday) {
            byProject.get(task.project_id)!.today.push(task);
          }
        }
      });
      
      return byProject;
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-status-completed";
      case "in_progress":
        return "bg-status-in-progress";
      case "on_hold":
        return "bg-status-on-hold";
      default:
        return "bg-status-pending";
    }
  };


  const handleDelete = async (reason: string) => {
    if (!deleteProject) return;
    
    setDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Log the deletion
      await supabase.from("deletion_logs").insert({
        entity_type: "project",
        entity_id: deleteProject.id,
        entity_name: deleteProject.title,
        deleted_by: session.session.user.id,
        reason,
      });

      // Remove foreign key references first
      await supabase.from("shooting_schedules").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("meetings").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("expenses").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("income").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("reimbursements").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("recurring_budget").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("ledger_entries").update({ project_id: null }).eq("project_id", deleteProject.id);
      
      // Delete tasks related to this project
      await supabase.from("tasks").delete().eq("project_id", deleteProject.id);

      // Delete the project
      const { error } = await supabase.from("projects").delete().eq("id", deleteProject.id);
      if (error) throw error;

      toast.success("Project dihapus");
      setDeleteProject(null);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus project");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Projects</h1>
          <div className="flex items-center gap-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects && projects.length > 0 ? (
              projects.map((project: any) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow relative group"
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteProject({ id: project.id, title: project.title });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-lg flex-1">{project.title}</h3>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status.replace("_", " ")}
                        </Badge>
                      </div>

                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      <div className="space-y-1 text-sm">
                        {project.clients && (
                          <p className="font-medium text-primary">
                            {project.clients.name}
                          </p>
                        )}
                        
                        {project.type && (
                          <p className="text-muted-foreground">
                            Type: {project.type}
                          </p>
                        )}

                        {project.profiles && (
                          <p className="text-muted-foreground">
                            Assigned: {project.profiles.full_name}
                          </p>
                        )}

                        {project.deadline && (
                          <p className="text-muted-foreground">
                            Deadline: {new Date(project.deadline).toLocaleDateString()}
                          </p>
                        )}

                        {/* Today's tasks indicator */}
                        {tasksByProject?.get(project.id)?.today?.length > 0 && (
                          <div className="mt-2 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
                              <Clock className="h-4 w-4" />
                              {tasksByProject.get(project.id)!.today.length} Hari Ini
                            </div>
                            <div className="mt-1 space-y-1">
                              {tasksByProject.get(project.id)!.today.slice(0, 2).map((task: any) => (
                                <p key={task.id} className="text-xs text-muted-foreground truncate">
                                  • {task.title}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Overdue tasks indicator */}
                        {tasksByProject?.get(project.id)?.overdue?.length > 0 && (
                          <div className="mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                              <AlertTriangle className="h-4 w-4" />
                              {tasksByProject.get(project.id)!.overdue.length} Overdue
                            </div>
                            <div className="mt-1 space-y-1">
                              {tasksByProject.get(project.id)!.overdue.slice(0, 3).map((task: any) => (
                                <p key={task.id} className="text-xs text-muted-foreground truncate">
                                  • {task.title}
                                </p>
                              ))}
                              {tasksByProject.get(project.id)!.overdue.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  +{tasksByProject.get(project.id)!.overdue.length - 3} more
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No projects found. Create your first project!
              </div>
            )}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <ProjectDetailDialog
        projectId={selectedProjectId}
        open={!!selectedProjectId}
        onOpenChange={(open) => !open && setSelectedProjectId(null)}
      />

      <DeleteConfirmDialog
        open={!!deleteProject}
        onOpenChange={(open) => !open && setDeleteProject(null)}
        title="Hapus Project"
        description={`Apakah Anda yakin ingin menghapus project "${deleteProject?.title}"? Semua task terkait mungkin akan terpengaruh.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </AppLayout>
  );
}
