import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
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
  Edit,
  ArrowLeft
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
import { EventCrewTab } from "@/components/event/tabs/EventCrewTab";
import { EventVendorTab } from "@/components/event/tabs/EventVendorTab";
import { EventTasksTab } from "@/components/event/tabs/EventTasksTab";
import { EventChecklistTab } from "@/components/event/tabs/EventChecklistTab";
import { EventDocumentsTab } from "@/components/event/tabs/EventDocumentsTab";
import { EventHistoryTab } from "@/components/event/tabs/EventHistoryTab";
import { EditEventDialog } from "@/components/event/EditEventDialog";

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

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
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
        .eq("id", eventId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event berhasil dihapus");
      navigate("/event");
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
        .eq("user_id", session.session.user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const updates: any = {};
      if (status) updates.status = status;
      if (phase) updates.current_phase = phase;

      const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", eventId!);

      if (error) throw error;

      // Log history
      if (status) {
        await supabase.from("event_history").insert({
          event_id: eventId!,
          action: "status_changed",
          old_value: event?.status,
          new_value: status,
          changed_by: profile.id,
        });
      }
      if (phase) {
        await supabase.from("event_history").insert({
          event_id: eventId!,
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
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("Gagal memperbarui status");
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Memuat data...</p>
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-muted-foreground">Event tidak ditemukan</p>
          <Button variant="outline" onClick={() => navigate("/event")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Event
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/event")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{event.name}</h1>
                <Badge className={statusColors[event.status]}>
                  {statusLabels[event.status]}
                </Badge>
                <Badge variant="outline">
                  {phaseLabels[event.current_phase]}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {eventTypeLabels[event.event_type] || event.event_type}
              </p>
            </div>
          </div>
          {canManageEvents && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </Button>
            </div>
          )}
        </div>

        {/* Event Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg">
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
          <div className="flex flex-wrap gap-6">
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
          <div className="p-4 border rounded-lg">
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
            <EventTasksTab eventId={eventId!} projectId={event.project_id} canManage={canManageEvents || false} />
          </TabsContent>
          
          <TabsContent value="crew" className="mt-4">
            <EventCrewTab eventId={eventId!} canManage={canManageEvents || false} />
          </TabsContent>
          
          <TabsContent value="vendors" className="mt-4">
            <EventVendorTab eventId={eventId!} canManage={canManageEvents || false} />
          </TabsContent>
          
          <TabsContent value="checklist" className="mt-4">
            <EventChecklistTab eventId={eventId!} canManage={canManageEvents || false} />
          </TabsContent>
          
          <TabsContent value="documents" className="mt-4">
            <EventDocumentsTab eventId={eventId!} canManage={canManageEvents || false} />
          </TabsContent>
          
          <TabsContent value="history" className="mt-4">
            <EventHistoryTab eventId={eventId!} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation */}
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

      {/* Edit Dialog */}
      <EditEventDialog
        event={event}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          refetch();
          setEditOpen(false);
        }}
      />
    </AppLayout>
  );
}
