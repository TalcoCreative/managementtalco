import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  Video,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";

type SharedShootingPayload = {
  shooting: any;
  crew: any[];
};

export default function SharedShooting() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-shooting-data", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");

      const { data, error } = await supabase.functions.invoke<SharedShootingPayload>(
        "shared-shooting",
        { body: { token } }
      );

      if (error) throw error;
      if (!data) throw new Error("Failed to load shared shooting");
      return data;
    },
    enabled: !!token,
  });

  const shooting = data?.shooting;
  const crew = data?.crew || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500";
      case "rejected":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-yellow-500";
    }
  };

  const campers = crew.filter((c: any) => c.role === "camper" && !c.is_freelance);
  const additional = crew.filter(
    (c: any) => c.role === "additional" && !c.is_freelance
  );
  const freelancers = crew.filter((c: any) => c.is_freelance);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading shooting...</p>
        </div>
      </div>
    );
  }

  if (error || !shooting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Shooting Not Found</h2>
            <p className="text-muted-foreground">
              This shooting link may have expired or is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Video className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">{shooting.title}</CardTitle>
                </div>
                <Badge className={getStatusColor(shooting.status)}>
                  {shooting.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date, Time, Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(shooting.scheduled_date), "PPP")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium">{shooting.scheduled_time}</p>
                </div>
              </div>

              {shooting.location && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3 sm:col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">{shooting.location}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Client & Project */}
            {(shooting.clients || shooting.projects) && (
              <>
                <Separator />
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Client / Project
                    </p>
                    <p className="font-medium">
                      {shooting.clients?.name}
                      {shooting.projects && ` - ${shooting.projects.title}`}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Reschedule info */}
            {shooting.rescheduled_from && (
              <div className="p-3 bg-yellow-500/10 rounded border border-yellow-500/20 text-sm">
                <span className="text-yellow-600 font-medium">Rescheduled</span>{" "}
                from {format(new Date(shooting.rescheduled_from), "PPP")}
                {shooting.reschedule_reason && (
                  <p className="text-muted-foreground mt-1">
                    Reason: {shooting.reschedule_reason}
                  </p>
                )}
              </div>
            )}

            {/* Cancelled info */}
            {shooting.cancelled_at && (
              <div className="p-3 bg-red-500/10 rounded border border-red-500/20 text-sm">
                <span className="text-red-600 font-medium">Cancelled</span>
                {shooting.cancel_reason && (
                  <p className="text-muted-foreground mt-1">
                    Reason: {shooting.cancel_reason}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Crew */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Crew Involved
              </h3>

              <div className="space-y-4">
                {/* Director & Runner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shooting.director_profile && (
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Director</p>
                      <p className="font-medium">
                        {shooting.director_profile.full_name}
                      </p>
                    </div>
                  )}
                  {shooting.runner_profile && (
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Runner</p>
                      <p className="font-medium">
                        {shooting.runner_profile.full_name}
                      </p>
                    </div>
                  )}
                </div>

                {/* Campers */}
                {campers.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Campers:</p>
                    <div className="flex flex-wrap gap-2">
                      {campers.map((c: any) => (
                        <Badge key={c.id} variant="outline">
                          {c.profiles?.full_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Crew */}
                {additional.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Additional Crew:</p>
                    <div className="flex flex-wrap gap-2">
                      {additional.map((c: any) => (
                        <Badge key={c.id} variant="outline">
                          {c.profiles?.full_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Freelancers */}
                {freelancers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Freelancers:</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {freelancers.map((f: any) => (
                        <Badge key={f.id} variant="secondary">
                          {f.freelance_name} ({f.role})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {shooting.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {shooting.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Shared via Talco Creative Indonesia
        </p>
      </div>
    </div>
  );
}
