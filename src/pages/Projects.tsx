import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const projectColumns = [
  { id: "pending", title: "Pending" },
  { id: "in_progress", title: "In Progress" },
  { id: "completed", title: "Completed" },
  { id: "on_hold", title: "On Hold" },
];

export default function Projects() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
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

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", itemId);

    if (error) {
      console.error("Error updating project:", error);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const getCardColor = (project: any) => {
    switch (project.status) {
      case "completed":
        return "border-l-4 border-l-status-completed bg-gradient-to-r from-status-completed/5 to-transparent";
      case "in_progress":
        return "border-l-4 border-l-status-in-progress bg-gradient-to-r from-status-in-progress/5 to-transparent";
      case "on_hold":
        return "border-l-4 border-l-status-on-hold bg-gradient-to-r from-status-on-hold/5 to-transparent";
      default:
        return "border-l-4 border-l-status-pending bg-gradient-to-r from-status-pending/5 to-transparent";
    }
  };

  const canManageProjects = userRole === "super_admin" || userRole === "hr";

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
            {canManageProjects && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : (
          <KanbanBoard
            columns={projectColumns}
            items={projects || []}
            onStatusChange={handleStatusChange}
            onCardClick={(project) => setSelectedProjectId(project.id)}
            getCardColor={getCardColor}
            renderCard={(project) => (
              <div className="space-y-2">
                <h4 className="font-medium">{project.title}</h4>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}
                {project.clients && (
                  <p className="text-xs font-medium text-primary">
                    {project.clients.name}
                  </p>
                )}
                {project.deadline && (
                  <p className="text-xs text-muted-foreground">
                    Due: {new Date(project.deadline).toLocaleDateString()}
                  </p>
                )}
                {project.profiles && (
                  <p className="text-xs text-muted-foreground">
                    Assigned: {project.profiles.full_name}
                  </p>
                )}
              </div>
            )}
          />
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
    </AppLayout>
  );
}
