import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Check, X, Building2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function ShootingNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["shooting-notifications"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const { data, error } = await supabase
        .from("shooting_notifications")
        .select(`
          *,
          shooting:shooting_schedules(
            id,
            title,
            scheduled_date,
            scheduled_time,
            location,
            status,
            rescheduled_from,
            reschedule_reason,
            clients(name),
            projects(title),
            requested_by_profile:profiles!fk_shooting_requested_by_profiles(full_name)
          )
        `)
        .eq("user_id", session.session.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const handleResponse = async (notificationId: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from("shooting_notifications")
        .update({ 
          status, 
          responded_at: new Date().toISOString() 
        })
        .eq("id", notificationId);

      if (error) throw error;
      toast.success(status === 'accepted' ? "You accepted the shooting request" : "You declined the shooting request");
      queryClient.invalidateQueries({ queryKey: ["shooting-notifications"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to respond");
    }
  };

  const getRoleLabel = (role: string | null) => {
    const labels: Record<string, string> = {
      director: "Director",
      runner: "Runner",
      camper: "Camper",
      additional: "Additional Crew",
    };
    return role ? labels[role] || role : "Crew";
  };

  if (isLoading || !notifications || notifications.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Shooting Requests
          <Badge variant="destructive">{notifications.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.map((notification: any) => (
            <div key={notification.id} className="p-3 border rounded-lg bg-accent/20">
              {/* Reschedule Warning */}
              {notification.shooting?.rescheduled_from && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-yellow-500/10 rounded text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-yellow-600 font-medium">Rescheduled</span>
                  <span className="text-muted-foreground">
                    from {format(new Date(notification.shooting.rescheduled_from), 'PPP')}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{notification.shooting?.title}</p>
                    <Badge variant="outline">{getRoleLabel(notification.crew_role)}</Badge>
                  </div>
                  
                  {/* Client & Project */}
                  {(notification.shooting?.clients || notification.shooting?.projects) && (
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-primary font-medium">
                        {notification.shooting?.clients?.name}
                      </span>
                      {notification.shooting?.projects && (
                        <span className="text-muted-foreground">
                          - {notification.shooting?.projects?.title}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    <span>
                      {notification.shooting?.scheduled_date && 
                        format(new Date(notification.shooting.scheduled_date), 'PPP')} at {notification.shooting?.scheduled_time}
                    </span>
                    {notification.shooting?.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {notification.shooting.location}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    From: {notification.shooting?.requested_by_profile?.full_name}
                  </p>

                  {notification.shooting?.reschedule_reason && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Reason: {notification.shooting.reschedule_reason}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => handleResponse(notification.id, 'accepted')}
                  className="gap-1"
                >
                  <Check className="h-4 w-4" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResponse(notification.id, 'declined')}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
