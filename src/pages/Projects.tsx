import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle, Clock, Eye, EyeOff, Pencil, Archive, Filter } from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { CompletedTasksFilter } from "@/components/tasks/CompletedTasksFilter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { isPast, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const projectColumns = [
  { id: "pending", title: "Pending" },
  { id: "in_progress", title: "In Progress" },
  { id: "on_hold", title: "On Hold" },
];

export default function Projects() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<any>(null);
  const [deleteProject, setDeleteProject] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [completedFilters, setCompletedFilters] = useState({
    search: "",
    client: "all",
    assignee: "all",
  });
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

  const { data: users } = useQuery({
    queryKey: ["users-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, status")
        .or("status.is.null,status.eq.active")
        .order("full_name");
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

  const activeProjects = useMemo(() => {
    return projects?.filter((p: any) => p.status !== "completed") || [];
  }, [projects]);

  const completedProjects = useMemo(() => {
    let completed = projects?.filter((p: any) => p.status === "completed") || [];
    
    if (completedFilters.search) {
      const s = completedFilters.search.toLowerCase();
      completed = completed.filter((p: any) => 
        p.title?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s)
      );
    }
    if (completedFilters.client !== "all") {
      completed = completed.filter((p: any) => p.client_id === completedFilters.client);
    }
    if (completedFilters.assignee !== "all") {
      completed = completed.filter((p: any) => p.assigned_to === completedFilters.assignee);
    }
    
    return completed;
  }, [projects, completedFilters]);

  const getCardColor = (project: any) => {
    const hasOverdue = tasksByProject?.get(project.id)?.overdue?.length > 0;
    const hasToday = tasksByProject?.get(project.id)?.today?.length > 0;
    
    if (hasOverdue) {
      return "border-l-4 border-l-destructive bg-gradient-to-r from-destructive/10 to-transparent";
    }
    if (hasToday) {
      return "border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-500/10 to-transparent";
    }
    switch (project.status) {
      case "in_progress":
        return "border-l-4 border-l-status-in-progress bg-gradient-to-r from-status-in-progress/5 to-transparent";
      case "on_hold":
        return "border-l-4 border-l-status-on-hold bg-gradient-to-r from-status-on-hold/5 to-transparent";
      default:
        return "border-l-4 border-l-status-pending bg-gradient-to-r from-status-pending/5 to-transparent";
    }
  };

  const handleToggleVisibility = async (e: React.MouseEvent, projectId: string, currentHidden: boolean) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("projects")
        .update({ hidden_from_dashboard: !currentHidden })
        .eq("id", projectId);

      if (error) throw error;

      toast.success(
        !currentHidden
          ? "Project hidden from client dashboard"
          : "Project visible on client dashboard"
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error: any) {
      toast.error("Failed to change visibility");
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: newStatus })
        .eq("id", projectId);

      if (error) throw error;

      toast.success("Project status updated");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error: any) {
      toast.error("Failed to change status");
    }
  };

  const handleDelete = async (reason: string) => {
    if (!deleteProject) return;
    
    setDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      await supabase.from("deletion_logs").insert({
        entity_type: "project",
        entity_id: deleteProject.id,
        entity_name: deleteProject.title,
        deleted_by: session.session.user.id,
        reason,
      });

      await supabase.from("shooting_schedules").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("meetings").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("expenses").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("income").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("reimbursements").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("recurring_budget").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("ledger_entries").update({ project_id: null }).eq("project_id", deleteProject.id);
      await supabase.from("tasks").delete().eq("project_id", deleteProject.id);

      const { error } = await supabase.from("projects").delete().eq("id", deleteProject.id);
      if (error) throw error;

      toast.success("Project deleted");
      setDeleteProject(null);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const renderProjectKanbanCard = (project: any) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium flex-1 line-clamp-2 text-sm sm:text-base">{project.title}</h4>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditProject(project);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => handleToggleVisibility(e, project.id, project.hidden_from_dashboard || false)}
                >
                  {project.hidden_from_dashboard ? (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Eye className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {project.hidden_from_dashboard ? "Show to Client" : "Hide from Client"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteProject({ id: project.id, title: project.title });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {project.clients && (
        <p className="text-xs sm:text-sm font-medium text-primary truncate">
          {project.clients.name}
        </p>
      )}

      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="space-y-1">
        {project.profiles && (
          <p className="text-xs text-muted-foreground">👤 {project.profiles.full_name}</p>
        )}
        {project.deadline && (
          <p className="text-xs text-muted-foreground">
            📅 {new Date(project.deadline).toLocaleDateString()}
          </p>
        )}
        {project.type && (
          <Badge variant="outline" className="text-[10px] h-5">{project.type}</Badge>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <Select
          value={project.status}
          onValueChange={(value) => handleStatusChange(project.id, value)}
        >
          <SelectTrigger className="h-7 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tasksByProject?.get(project.id)?.today?.length > 0 && (
        <div className="p-1.5 bg-amber-500/10 rounded border border-amber-500/20">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
            <Clock className="h-3 w-3" />
            {tasksByProject.get(project.id)!.today.length} Hari Ini
          </div>
        </div>
      )}
      
      {tasksByProject?.get(project.id)?.overdue?.length > 0 && (
        <div className="p-1.5 bg-destructive/10 rounded border border-destructive/20">
          <div className="flex items-center gap-1 text-destructive text-xs font-medium">
            <AlertTriangle className="h-3 w-3" />
            {tasksByProject.get(project.id)!.overdue.length} Overdue
          </div>
        </div>
      )}

      {project.hidden_from_dashboard && (
        <Badge variant="secondary" className="text-[10px] h-5">
          <EyeOff className="h-2.5 w-2.5 mr-1" />
          Hidden
        </Badge>
      )}
    </div>
  );

  const renderCompletedProjectCard = (project: any) => (
    <Card
      key={project.id}
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-status-completed"
      onClick={() => setSelectedProjectId(project.id)}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="font-medium text-sm line-clamp-1">{project.title}</h4>
            {project.clients && (
              <p className="text-xs text-primary font-medium truncate">{project.clients.name}</p>
            )}
            {project.profiles && (
              <p className="text-xs text-muted-foreground">👤 {project.profiles.full_name}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Select
              value={project.status}
              onValueChange={(value) => handleStatusChange(project.id, value)}
            >
              <SelectTrigger
                className="w-28 h-7 text-xs bg-status-completed text-white border-0"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent onClick={(e) => e.stopPropagation()}>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setEditProject(project);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteProject({ id: project.id, title: project.title });
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Projects</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 sm:h-9">
                  <Filter className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  <span className="sm:hidden">Filter</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-72" align="end">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Filter Projects</h4>
                  <div className="space-y-2">
                    <Label className="text-xs">Client</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Clients" />
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
                  </div>
                  <Button variant="outline" onClick={() => setSelectedClient("all")} className="w-full h-9">
                    Clear Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={() => setCreateDialogOpen(true)} className="h-10 sm:h-9">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex h-auto">
            <TabsTrigger value="active" className="h-10 sm:h-9 text-sm">Active Projects</TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2 h-10 sm:h-9 text-sm">
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Completed</span>
              <span className="sm:hidden">Done</span>
              {completedProjects.length > 0 && (
                <Badge variant="secondary" className="ml-1">{completedProjects.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading projects...</p>
              </div>
            ) : (
              <KanbanBoard
                columns={projectColumns}
                items={activeProjects}
                onStatusChange={handleStatusChange}
                onCardClick={(project) => setSelectedProjectId(project.id)}
                getCardColor={getCardColor}
                renderCard={renderProjectKanbanCard}
              />
            )}
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-4">
              {/* Completed filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Search projects..."
                  value={completedFilters.search}
                  onChange={(e) => setCompletedFilters(f => ({ ...f, search: e.target.value }))}
                  className="h-9 sm:w-64"
                />
                <Select value={completedFilters.client} onValueChange={(v) => setCompletedFilters(f => ({ ...f, client: v }))}>
                  <SelectTrigger className="h-9 sm:w-48">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={completedFilters.assignee} onValueChange={(v) => setCompletedFilters(f => ({ ...f, assignee: v }))}>
                  <SelectTrigger className="h-9 sm:w-48">
                    <SelectValue placeholder="All Assignees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assignees</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {completedProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No completed projects found.
                </div>
              ) : (
                <div className="space-y-2">
                  {completedProjects.map((project: any) => renderCompletedProjectCard(project))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <EditProjectDialog
        project={editProject}
        open={!!editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
      />

      <ProjectDetailDialog
        projectId={selectedProjectId}
        open={!!selectedProjectId}
        onOpenChange={(open) => !open && setSelectedProjectId(null)}
      />

      <DeleteConfirmDialog
        open={!!deleteProject}
        onOpenChange={(open) => !open && setDeleteProject(null)}
        title="Delete Project"
        description={`Are you sure you want to delete project "${deleteProject?.title}"? All related tasks may be affected.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </AppLayout>
  );
}
