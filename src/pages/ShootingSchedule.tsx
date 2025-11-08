import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, Users, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreateShootingDialog } from "@/components/shooting/CreateShootingDialog";

export default function ShootingSchedule() {
  const [selectedShooting, setSelectedShooting] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch user role
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

  // Fetch shooting schedules
  const { data: shootings } = useQuery({
    queryKey: ["shooting-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select(`
          *,
          requested_by_profile:profiles!shooting_schedules_requested_by_fkey(full_name),
          runner_profile:profiles!shooting_schedules_runner_fkey(full_name),
          director_profile:profiles!shooting_schedules_director_fkey(full_name)
        `)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch crew for each shooting
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
      toast.success("Shooting schedule approved!");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
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
      toast.success("Shooting schedule rejected");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to reject");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500";
      case "rejected": return "bg-red-500";
      default: return "bg-yellow-500";
    }
  };

  const getCrew = (shootingId: string) => {
    return allCrew?.filter(c => c.shooting_id === shootingId) || [];
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

        <div className="grid gap-4">
          {shootings?.map((shooting) => {
            const crew = getCrew(shooting.id);
            const campers = crew.filter(c => c.role === 'camper');
            const additional = crew.filter(c => c.role === 'additional');

            return (
              <Card key={shooting.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{shooting.title}</CardTitle>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(shooting.scheduled_date), 'PPP')} at {shooting.scheduled_time}
                        </div>
                        {shooting.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {shooting.location}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={getStatusColor(shooting.status)}>
                      {shooting.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
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
          })}
        </div>
      </div>
    </AppLayout>
  );
}
