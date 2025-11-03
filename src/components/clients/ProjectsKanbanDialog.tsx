import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateProjectDialog } from "./CreateProjectDialog";

interface ProjectsKanbanDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const projectColumns = [
  { id: "pending", title: "Pending" },
  { id: "in_progress", title: "In Progress" },
  { id: "completed", title: "Completed" },
  { id: "on_hold", title: "On Hold" },
];

export function ProjectsKanbanDialog({ clientId, open, onOpenChange }: ProjectsKanbanDialogProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles(full_name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
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

    queryClient.invalidateQueries({ queryKey: ["client-projects", clientId] });
  };

  const canManageProjects = userRole === "super_admin" || userRole === "hr";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Projects - {client?.name}</DialogTitle>
              {canManageProjects && (
                <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              )}
            </div>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading projects...</p>
            </div>
          ) : (
            <KanbanBoard
              columns={projectColumns}
              items={projects || []}
              onStatusChange={handleStatusChange}
              renderCard={(project) => (
                <div className="space-y-2">
                  <h4 className="font-medium">{project.title}</h4>
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
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
        </DialogContent>
      </Dialog>

      <CreateProjectDialog
        clientId={clientId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
