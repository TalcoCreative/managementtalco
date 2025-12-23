import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { MapPin, Users, Check, X, DollarSign, Trash2, CalendarClock, Building2 } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { toast } from "sonner";
import { CreateShootingDialog } from "@/components/shooting/CreateShootingDialog";
import { RescheduleShootingDialog } from "@/components/shooting/RescheduleShootingDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { ShootingDetailDialog } from "@/components/shooting/ShootingDetailDialog";

export default function ShootingSchedule() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [deleteShooting, setDeleteShooting] = useState<{ id: string; title: string } | null>(null);
  const [rescheduleShooting, setRescheduleShooting] = useState<{ id: string; title: string; scheduled_date: string } | null>(null);
  const [selectedShootingId, setSelectedShootingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id)
        .single();
      if (error) throw error;
      return data?.role;
    },
  });

  const { data: shootings } = useQuery({
    queryKey: ["shooting-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select(`
          *,
          requested_by_profile:profiles!fk_shooting_requested_by_profiles(full_name),
          runner_profile:profiles!fk_shooting_runner_profiles(full_name),
          director_profile:profiles!fk_shooting_director_profiles(full_name),
          clients(name),
          projects(title)
        `)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allCrew } = useQuery({
    queryKey: ["shooting-crew"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_crew")
        .select("*, profiles(full_name)");
      if (error) throw error;
      return data as any[];
    },
  });

  const canApprove = userRole === 'hr' || userRole === 'super_admin';

  const handleApprove = async (shootingId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { error } = await supabase
        .from("shooting_schedules")
        .update({
          status: "approved",
          approved_by: session.session.user.id,
        })
        .eq("id", shootingId);

      if (error) throw error;

      // Update linked task to in_progress
      const { data: shooting } = await supabase
        .from("shooting_schedules")
        .select("task_id")
        .eq("id", shootingId)
        .single();

      if (shooting?.task_id) {
        await supabase
          .from("tasks")
          .update({ status: "in_progress" })
          .eq("id", shooting.task_id);
      }

      toast.success("Shooting schedule approved!");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to approve");
    }
  };

  const handleReject = async (shootingId: string) => {
    try {
      const { error } = await supabase
        .from("shooting_schedules")
        .update({ status: "rejected" })
        .eq("id", shootingId);

      if (error) throw error;

      // Update linked task to on_hold
      const { data: shooting } = await supabase
        .from("shooting_schedules")
        .select("task_id")
        .eq("id", shootingId)
        .single();

      if (shooting?.task_id) {
        await supabase
          .from("tasks")
          .update({ status: "on_hold" })
          .eq("id", shooting.task_id);
      }

      toast.success("Shooting schedule rejected");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to reject");
    }
  };

  const handleDelete = async (reason: string) => {
    if (!deleteShooting) return;
    
    setDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Log the deletion
      await supabase.from("deletion_logs").insert({
        entity_type: "shooting",
        entity_id: deleteShooting.id,
        entity_name: deleteShooting.title,
        deleted_by: session.session.user.id,
        reason,
      });

      // Delete the shooting schedule
      const { error } = await supabase.from("shooting_schedules").delete().eq("id", deleteShooting.id);
      if (error) throw error;

      toast.success("Shooting schedule dihapus");
      setDeleteShooting(null);
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus shooting schedule");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500";
      case "rejected": return "bg-red-500";
      case "cancelled": return "bg-gray-500";
      default: return "bg-yellow-500";
    }
  };

  const getCrew = (shootingId: string) => {
    return allCrew?.filter(c => c.shooting_id === shootingId) || [];
  };

  // Get dates that have shootings for calendar highlighting
  const shootingDates = shootings?.map(s => new Date(s.scheduled_date)) || [];
  
  // Filter shootings for selected date
  const selectedDateShootings = selectedDate 
    ? shootings?.filter(s => isSameDay(new Date(s.scheduled_date), selectedDate))
    : [];

  const renderShootingCard = (shooting: any) => {
    const crew = getCrew(shooting.id);
    const campers = crew.filter(c => c.role === 'camper' && !c.is_freelance);
    const additional = crew.filter(c => c.role === 'additional' && !c.is_freelance);
    const freelancers = crew.filter(c => c.is_freelance);
    const totalFreelanceCost = freelancers.reduce((sum, f) => sum + (f.freelance_cost || 0), 0);

    return (
      <Card 
        key={shooting.id} 
        className="relative group cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setSelectedShootingId(shooting.id)}
      >
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setRescheduleShooting({
                id: shooting.id,
                title: shooting.title,
                scheduled_date: shooting.scheduled_date,
              });
            }}
          >
            <CalendarClock className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteShooting({ id: shooting.id, title: shooting.title });
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{shooting.title}</CardTitle>
              <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                <span>{format(new Date(shooting.scheduled_date), 'PPP')} at {shooting.scheduled_time}</span>
                {shooting.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {shooting.location}
                  </div>
                )}
              </div>
              {/* Client & Project */}
              {(shooting.clients || shooting.projects) && (
                <div className="flex items-center gap-2 mt-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-primary">
                    {shooting.clients?.name}
                  </span>
                  {shooting.projects && (
                    <span className="text-sm text-muted-foreground">
                      - {shooting.projects.title}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Badge className={getStatusColor(shooting.status)}>
              {shooting.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Reschedule info */}
            {shooting.rescheduled_from && (
              <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/20 text-sm">
                <span className="text-yellow-600 font-medium">Rescheduled</span> from {format(new Date(shooting.rescheduled_from), 'PPP')}
                {shooting.reschedule_reason && (
                  <p className="text-muted-foreground mt-1">Reason: {shooting.reschedule_reason}</p>
                )}
              </div>
            )}

            {/* Cancelled info */}
            {shooting.cancelled_at && (
              <div className="p-2 bg-red-500/10 rounded border border-red-500/20 text-sm">
                <span className="text-red-600 font-medium">Cancelled</span>
                {shooting.cancel_reason && (
                  <p className="text-muted-foreground mt-1">Reason: {shooting.cancel_reason}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Requested by: </span>
                <span className="font-medium">{shooting.requested_by_profile?.full_name}</span>
              </div>
              {shooting.director_profile && (
                <div>
                  <span className="text-muted-foreground">Director: </span>
                  <span className="font-medium">{shooting.director_profile.full_name}</span>
                </div>
              )}
              {shooting.runner_profile && (
                <div>
                  <span className="text-muted-foreground">Runner: </span>
                  <span className="font-medium">{shooting.runner_profile.full_name}</span>
                </div>
              )}
            </div>

            {campers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Campers:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {campers.map(c => (
                    <Badge key={c.id} variant="outline">{c.profiles?.full_name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {additional.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Additional Crew:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {additional.map(c => (
                    <Badge key={c.id} variant="outline">{c.profiles?.full_name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {freelancers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Freelancers:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {freelancers.map(f => (
                    <Badge key={f.id} variant="secondary">
                      {f.freelance_name} ({f.role}) - Rp {(f.freelance_cost || 0).toLocaleString()}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm font-medium mt-2">
                  Total Freelance Cost: Rp {totalFreelanceCost.toLocaleString()}
                </p>
              </div>
            )}

            {shooting.notes && (
              <p className="text-sm text-muted-foreground">{shooting.notes}</p>
            )}

            {canApprove && shooting.status === 'pending' && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(shooting.id)}
                  className="gap-1"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(shooting.id)}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Shooting Schedule</h1>
            <p className="text-muted-foreground">Manage shooting requests and schedules</p>
          </div>
          <CreateShootingDialog />
        </div>

        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="list">List View</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
              <Card>
                <CardContent className="p-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="pointer-events-auto"
                    modifiers={{
                      hasShooting: shootingDates,
                    }}
                    modifiersStyles={{
                      hasShooting: {
                        backgroundColor: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                        borderRadius: "50%",
                      },
                    }}
                  />
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold">
                  {selectedDate ? format(selectedDate, 'PPP') : 'Select a date'}
                </h2>
                {selectedDateShootings && selectedDateShootings.length > 0 ? (
                  <div className="space-y-4">
                    {selectedDateShootings.map(renderShootingCard)}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No shootings scheduled for this date
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            {shootings?.map(renderShootingCard)}
          </TabsContent>
        </Tabs>
      </div>

      <DeleteConfirmDialog
        open={!!deleteShooting}
        onOpenChange={(open) => !open && setDeleteShooting(null)}
        title="Hapus Shooting Schedule"
        description={`Apakah Anda yakin ingin menghapus shooting "${deleteShooting?.title}"?`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <RescheduleShootingDialog
        shooting={rescheduleShooting}
        open={!!rescheduleShooting}
        onOpenChange={(open) => !open && setRescheduleShooting(null)}
      />

      <ShootingDetailDialog
        shootingId={selectedShootingId}
        open={!!selectedShootingId}
        onOpenChange={(open) => !open && setSelectedShootingId(null)}
      />
    </AppLayout>
  );
}
