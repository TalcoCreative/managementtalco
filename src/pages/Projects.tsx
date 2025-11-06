import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function Projects() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects && projects.length > 0 ? (
              projects.map((project: any) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedProjectId(project.id)}
                >
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
    </AppLayout>
  );
}
