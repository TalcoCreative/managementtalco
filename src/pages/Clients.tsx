import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Building2, Trash2, FolderOpen, CheckCircle2, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreateClientDialog } from "@/components/clients/CreateClientDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Clients() {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteClient, setDeleteClient] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter clients based on type
  const filteredClients = clients?.filter(client => {
    if (typeFilter === "all") return true;
    return client.client_type === typeFilter;
  });

  // Fetch projects count for each client
  const { data: projectCounts } = useQuery({
    queryKey: ["client-project-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("client_id");
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach(p => {
        counts[p.client_id] = (counts[p.client_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Fetch tasks count for each client
  const { data: taskCounts } = useQuery({
    queryKey: ["client-task-counts"],
    queryFn: async () => {
      const { data: projects, error: projectError } = await supabase
        .from("projects")
        .select("id, client_id");
      if (projectError) throw projectError;

      const projectClientMap = new Map(projects.map(p => [p.id, p.client_id]));
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) return {};

      const { data: tasks, error: taskError } = await supabase
        .from("tasks")
        .select("project_id")
        .in("project_id", projectIds);
      if (taskError) throw taskError;

      const counts: Record<string, number> = {};
      tasks.forEach(t => {
        const clientId = projectClientMap.get(t.project_id);
        if (clientId) {
          counts[clientId] = (counts[clientId] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const { data: userRole, isLoading: loadingRole } = useQuery({
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

  const isSuperAdmin = userRole === "super_admin";

  // All authenticated users can access /clients

  const handleDelete = async (reason: string) => {
    if (!deleteClient) return;
    
    setDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Log the deletion
      await supabase.from("deletion_logs").insert({
        entity_type: "client",
        entity_id: deleteClient.id,
        entity_name: deleteClient.name,
        deleted_by: session.session.user.id,
        reason,
      });

      // Delete the client
      const { error } = await supabase.from("clients").delete().eq("id", deleteClient.id);
      if (error) throw error;

      toast.success("Client dihapus");
      setDeleteClient(null);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus client");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Clients</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px] sm:w-[150px] h-10 sm:h-9">
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>
            {isSuperAdmin && (
              <Button onClick={() => setCreateDialogOpen(true)} className="h-10 sm:h-9">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Client</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 sm:h-32 bg-muted" />
              </Card>
            ))}
          </div>
        ) : filteredClients && filteredClients.length > 0 ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 relative group"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                {isSuperAdmin && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteClient({ id: client.id, name: client.name });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${client.client_type === 'internal' ? 'bg-blue-500/20' : 'bg-gradient-primary'}`}>
                        {client.client_type === 'internal' ? (
                          <Home className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Building2 className="h-5 w-5 text-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{client.name}</CardTitle>
                        {client.company && (
                          <p className="text-sm text-muted-foreground">{client.company}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {client.client_type === 'internal' && (
                        <Badge variant="outline" className="border-blue-500 text-blue-500 text-xs">
                          Internal
                        </Badge>
                      )}
                      <Badge 
                        variant={client.status === "active" ? "default" : client.status === "upcoming" ? "outline" : "secondary"}
                        className={client.status === "upcoming" ? "border-primary text-primary" : ""}
                      >
                        {client.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <FolderOpen className="h-4 w-4" />
                      <span>{projectCounts?.[client.id] || 0} Projects</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{taskCounts?.[client.id] || 0} Tasks</span>
                    </div>
                  </div>
                  {client.email && (
                    <p className="text-sm text-muted-foreground">{client.email}</p>
                  )}
                  {client.phone && (
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No clients yet</p>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateClientDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      <DeleteConfirmDialog
        open={!!deleteClient}
        onOpenChange={(open) => !open && setDeleteClient(null)}
        title="Hapus Client"
        description={`Apakah Anda yakin ingin menghapus client "${deleteClient?.name}"? Semua project dan task terkait mungkin akan terpengaruh.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </AppLayout>
  );
}
