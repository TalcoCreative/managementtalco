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
  Video,
  Users,
  Building2,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import { format } from "date-fns";

type SharedMeetingPayload = {
  meeting: any;
  participants: any[];
  externalParticipants: any[];
};

export default function SharedMeeting() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-meeting-data", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");

      const { data, error } = await supabase.functions.invoke<SharedMeetingPayload>(
        "shared-meeting",
        { body: { token } }
      );

      if (error) throw error;
      if (!data) throw new Error("Failed to load shared meeting");
      return data;
    },
    enabled: !!token,
  });

  const meeting = data?.meeting;
  const participants = data?.participants || [];
  const externalParticipants = data?.externalParticipants || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      case "scheduled":
        return "bg-blue-500";
      default:
        return "bg-muted";
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "internal":
        return "bg-blue-100 text-blue-800";
      case "external":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-muted";
    }
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case "online":
        return "bg-green-100 text-green-800";
      case "offline":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-muted";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Meeting Not Found</h2>
            <p className="text-muted-foreground">
              This meeting link may have expired or is no longer available.
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
                  <CardTitle className="text-2xl">{meeting.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getStatusColor(meeting.status)}>
                    {meeting.status}
                  </Badge>
                  <Badge className={getTypeBadge(meeting.type)}>
                    {meeting.type}
                  </Badge>
                  <Badge className={getModeBadge(meeting.mode)}>
                    {meeting.mode}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(meeting.meeting_date), "PPP")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {meeting.start_time} - {meeting.end_time}
                  </p>
                </div>
              </div>
            </div>

            {/* Location / Link */}
            {(meeting.location || meeting.meeting_link) && (
              <div className="grid grid-cols-1 gap-3">
                {meeting.location && (
                  <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium">{meeting.location}</p>
                    </div>
                  </div>
                )}
                {meeting.meeting_link && (
                  <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Meeting Link</p>
                      <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline truncate block"
                      >
                        {meeting.meeting_link}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Client / Project */}
            {(meeting.clients || meeting.projects) && (
              <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Client / Project</p>
                  <p className="font-medium">
                    {meeting.clients?.name}
                    {meeting.projects && ` - ${meeting.projects.title}`}
                  </p>
                </div>
              </div>
            )}

            {/* Reschedule info */}
            {meeting.original_date && (
              <div className="p-3 bg-yellow-500/10 rounded border border-yellow-500/20 text-sm">
                <span className="text-yellow-600 font-medium">Rescheduled</span>{" "}
                from {format(new Date(meeting.original_date), "PPP")}
                {meeting.reschedule_reason && (
                  <p className="text-muted-foreground mt-1">
                    Reason: {meeting.reschedule_reason}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Participants */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants
              </h3>

              {/* Internal Participants */}
              {participants.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Internal:</p>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((p: any) => (
                      <Badge
                        key={p.id}
                        variant={p.status === "accepted" ? "default" : "outline"}
                      >
                        {p.user?.full_name}
                        {p.status === "accepted" && " ✓"}
                        {p.status === "rejected" && " ✗"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* External Participants */}
              {externalParticipants.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">External:</p>
                  <div className="flex flex-wrap gap-2">
                    {externalParticipants.map((p: any) => (
                      <Badge key={p.id} variant="secondary">
                        {p.name}
                        {p.company && ` (${p.company})`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {meeting.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Agenda / Notes
                  </h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {meeting.notes}
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
