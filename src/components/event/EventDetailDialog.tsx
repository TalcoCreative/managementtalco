import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Building2, 
  Briefcase,
  Clock,
  Trash2,
  Edit
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EventCrewTab } from "./tabs/EventCrewTab";
import { EventVendorTab } from "./tabs/EventVendorTab";
import { EventTasksTab } from "./tabs/EventTasksTab";
import { EventChecklistTab } from "./tabs/EventChecklistTab";
import { EventDocumentsTab } from "./tabs/EventDocumentsTab";
import { EventHistoryTab } from "./tabs/EventHistoryTab";
import { EditEventDialog } from "./EditEventDialog";

interface EventDetailDialogProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusColors: Record<string, string> = {
  planning: "bg-blue-100 text-blue-800",
  preparation: "bg-yellow-100 text-yellow-800",
  on_going: "bg-green-100 text-green-800",
  done: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  planning: "Planning",
  preparation: "Preparation",
  on_going: "On Going",
  done: "Done",
  cancelled: "Cancelled",
};

const phaseLabels: Record<string, string> = {
  pre_event: "Pre-Event",
  production: "Production / Preparation",
  execution: "Execution Day",
  post_event: "Post Event",
};

const eventTypeLabels: Record<string, string> = {
  launching: "Launching",
  activation: "Activation",
  performance: "Performance",
  seminar: "Seminar",
  campaign: "Campaign",
  other: "Lainnya",
};

export function EventDetailDialog({ eventId, open, onOpenChange, onUpdate }: EventDetailDialogProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: event, isLoading, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          client:clients(id, name),
          project:projects(id, title),
          pic:profiles!events_pic_id_fkey(id, full_name),
          created_by_profile:profiles!events_created_by_fkey(full_name)
        `)
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && open,
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id);
      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
  });

  const canManageEvents = userRoles?.includes('super_admin') || 
                          userRoles?.includes('hr') || 
                          userRoles?.includes('project_manager');

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event berhasil dihapus");
      onOpenChange(false);
      onUpdate();
    },
    onError: (error) => {
      console.error("Error deleting event:", error);
      toast.error("Gagal menghapus event");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, phase }: { status?: string; phase?: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.session.user.email)
        .single();

      if (!profile) throw new Error("Profile not found");

      const updates: any = {};
      if (status) updates.status = status;
      if (phase) updates.current_phase = phase;

      const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", eventId);

      if (error) throw error;

      // Log history
      if (status) {
        await supabase.from("event_history").insert({
          event_id: eventId,
          action: "status_changed",
          old_value: event?.status,
          new_value: status,
          changed_by: profile.id,
        });
      }
      if (phase) {
        await supabase.from("event_history").insert({
          event_id: eventId,
          action: "phase_changed",
          old_value: event?.current_phase,
          new_value: phase,
          changed_by: profile.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Status berhasil diperbarui");
      refetch();
      onUpdate();
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("Gagal memperbarui status");
    },
  });

  if (isLoading || !event) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-8">
            Memuat data...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl">{event.name}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {eventTypeLabels[event.event_type] || event.event_type}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColors[event.status]}>
                  {statusLabels[event.status]}
                </Badge>
                <Badge variant="outline">
                  {phaseLabels[event.current_phase]}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Event Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal</p>
                  <p className="text-sm font-medium">
                    {format(new Date(event.start_date), "d MMM yyyy", { locale: localeId })}
                    {event.end_date !== event.start_date && (
                      <> - {format(new Date(event.end_date), "d MMM yyyy", { locale: localeId })}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Waktu</p>
                  <p className="text-sm font-medium">
                    {format(new Date(event.start_date), "HH:mm")} - {format(new Date(event.end_date), "HH:mm")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Lokasi</p>
                  <p className="text-sm font-medium">
                    {event.is_online ? "Online" : event.location || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">PIC</p>
                  <p className="text-sm font-medium">{event.pic?.full_name || "-"}</p>
                </div>
              </div>
              {event.client && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="text-sm font-medium">{event.client.name}</p>
                  </div>
                </div>
              )}
              {event.project && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Project</p>
                    <p className="text-sm font-medium">{event.project.title}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status & Phase Controls */}
            {canManageEvents && (
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium mb-2">Update Status:</p>
                  <div className="flex flex-wrap gap-2">
                    {["planning", "preparation", "on_going", "done", "cancelled"].map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={event.status === status ? "default" : "outline"}
                        onClick={() => updateStatusMutation.mutate({ status })}
                        disabled={updateStatusMutation.isPending}
                      >
                        {statusLabels[status]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Update Phase:</p>
                  <div className="flex flex-wrap gap-2">
                    {["pre_event", "production", "execution", "post_event"].map((phase) => (
                      <Button
                        key={phase}
                        size="sm"
                        variant={event.current_phase === phase ? "default" : "outline"}
                        onClick={() => updateStatusMutation.mutate({ phase })}
                        disabled={updateStatusMutation.isPending}
                      >
                        {phaseLabels[phase]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {event.notes && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-1">Catatan:</p>
                <p className="text-sm text-muted-foreground">{event.notes}</p>
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="crew">Crew</TabsTrigger>
                <TabsTrigger value="vendors">Vendor</TabsTrigger>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="documents">Dokumen</TabsTrigger>
                <TabsTrigger value="history">Riwayat</TabsTrigger>
              </TabsList>
              
              <TabsContent value="tasks" className="mt-4">
                <EventTasksTab eventId={eventId} projectId={event.project_id} canManage={canManageEvents} />
              </TabsContent>
              
              <TabsContent value="crew" className="mt-4">
                <EventCrewTab eventId={eventId} canManage={canManageEvents} />
              </TabsContent>
              
              <TabsContent value="vendors" className="mt-4">
                <EventVendorTab eventId={eventId} canManage={canManageEvents} />
              </TabsContent>
              
              <TabsContent value="checklist" className="mt-4">
                <EventChecklistTab eventId={eventId} canManage={canManageEvents} />
              </TabsContent>
              
              <TabsContent value="documents" className="mt-4">
                <EventDocumentsTab eventId={eventId} canManage={canManageEvents} />
              </TabsContent>
              
              <TabsContent value="history" className="mt-4">
                <EventHistoryTab eventId={eventId} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer Actions */}
          {canManageEvents && (
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Event
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Event?</AlertDialogTitle>
            <AlertDialogDescription>
              Event "{event.name}" akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditEventDialog
        event={event}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          refetch();
          onUpdate();
          setEditOpen(false);
        }}
      />
    </>
  );
}
