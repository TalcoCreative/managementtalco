import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MapPin, Users, DollarSign, Building2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EditShootingDialog } from "./EditShootingDialog";

interface ShootingDetailDialogProps {
  shootingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShootingDetailDialog({ shootingId, open, onOpenChange }: ShootingDetailDialogProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: shooting } = useQuery({
    queryKey: ["shooting-detail", shootingId],
    queryFn: async () => {
      if (!shootingId) return null;
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
        .eq("id", shootingId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!shootingId,
  });

  const { data: crew } = useQuery({
    queryKey: ["shooting-crew", shootingId],
    queryFn: async () => {
      if (!shootingId) return [];
      const { data, error } = await supabase
        .from("shooting_crew")
        .select("*, profiles(full_name)")
        .eq("shooting_id", shootingId);
      if (error) throw error;
      return data;
    },
    enabled: !!shootingId,
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

  const canApprove = userRole === 'hr' || userRole === 'super_admin';

  const handleApprove = async () => {
    if (!shootingId) return;
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

      if (shooting?.task_id) {
        await supabase
          .from("tasks")
          .update({ status: "in_progress" })
          .eq("id", shooting.task_id);
      }

      toast.success("Shooting schedule approved!");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-detail", shootingId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!shootingId) return;
    try {
      const { error } = await supabase
        .from("shooting_schedules")
        .update({ status: "rejected" })
        .eq("id", shootingId);

      if (error) throw error;

      if (shooting?.task_id) {
        await supabase
          .from("tasks")
          .update({ status: "on_hold" })
          .eq("id", shooting.task_id);
      }

      toast.success("Shooting schedule rejected");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-detail", shootingId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to reject");
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

  const campers = crew?.filter(c => c.role === 'camper' && !c.is_freelance) || [];
  const additional = crew?.filter(c => c.role === 'additional' && !c.is_freelance) || [];
  const freelancers = crew?.filter(c => c.is_freelance) || [];
  const totalFreelanceCost = freelancers.reduce((sum, f) => sum + (f.freelance_cost || 0), 0);

  if (!shooting) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-xl">{shooting.title}</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Badge className={getStatusColor(shooting.status)}>
                  {shooting.status}
                </Badge>
              </div>
            </div>
          </DialogHeader>

        <div className="space-y-6">
          {/* Date, Time, Location */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {format(new Date(shooting.scheduled_date), 'PPP')} at {shooting.scheduled_time}
            </div>
            {shooting.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {shooting.location}
              </div>
            )}
          </div>

          {/* Client & Project */}
          {(shooting.clients || shooting.projects) && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-primary">
                {shooting.clients?.name}
              </span>
              {shooting.projects && (
                <span className="text-muted-foreground">
                  - {shooting.projects.title}
                </span>
              )}
            </div>
          )}

          {/* Reschedule info */}
          {shooting.rescheduled_from && (
            <div className="p-3 bg-yellow-500/10 rounded border border-yellow-500/20 text-sm">
              <span className="text-yellow-600 font-medium">Rescheduled</span> from {format(new Date(shooting.rescheduled_from), 'PPP')}
              {shooting.reschedule_reason && (
                <p className="text-muted-foreground mt-1">Reason: {shooting.reschedule_reason}</p>
              )}
            </div>
          )}

          {/* Cancelled info */}
          {shooting.cancelled_at && (
            <div className="p-3 bg-red-500/10 rounded border border-red-500/20 text-sm">
              <span className="text-red-600 font-medium">Cancelled</span>
              {shooting.cancel_reason && (
                <p className="text-muted-foreground mt-1">Reason: {shooting.cancel_reason}</p>
              )}
            </div>
          )}

          {/* Team info */}
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

          {/* Campers */}
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

          {/* Additional Crew */}
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

          {/* Freelancers */}
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

          {/* Notes */}
          {shooting.notes && (
            <div>
              <span className="text-sm font-medium">Notes:</span>
              <p className="text-sm text-muted-foreground mt-1">{shooting.notes}</p>
            </div>
          )}

          {/* Approve/Reject buttons */}
          {canApprove && shooting.status === 'pending' && (
            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={handleApprove} className="gap-1">
                <Check className="h-4 w-4" />
                Approve
              </Button>
              <Button variant="destructive" onClick={handleReject} className="gap-1">
                <X className="h-4 w-4" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <EditShootingDialog
      shootingId={shootingId}
      open={editOpen}
      onOpenChange={setEditOpen}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["shooting-detail", shootingId] });
        queryClient.invalidateQueries({ queryKey: ["shooting-crew", shootingId] });
      }}
    />
  </>
  );
}
