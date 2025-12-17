import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Calendar, Clock, MapPin, Video, Users, Building2, 
  Link as LinkIcon, Check, X, ExternalLink 
} from "lucide-react";
import { format, parseISO, isToday, isFuture } from "date-fns";
import { id } from "date-fns/locale";

interface MeetingDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: any;
  onUpdate: () => void;
  isHRorAdmin?: boolean;
}

const MeetingDetailDialog = ({ 
  open, 
  onOpenChange, 
  meeting, 
  onUpdate,
  isHRorAdmin 
}: MeetingDetailDialogProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch participants
  const { data: participants, refetch: refetchParticipants } = useQuery({
    queryKey: ["meeting-participants", meeting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .select(`
          *,
          user:profiles(id, full_name, email)
        `)
        .eq("meeting_id", meeting.id);
      if (error) throw error;
      return data;
    },
    enabled: !!meeting.id,
  });

  // Fetch external participants
  const { data: externalParticipants } = useQuery({
    queryKey: ["meeting-external-participants", meeting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_external_participants")
        .select("*")
        .eq("meeting_id", meeting.id);
      if (error) throw error;
      return data;
    },
    enabled: !!meeting.id,
  });

  const isCreator = currentUser?.id === meeting.created_by;
  const canEdit = isCreator || isHRorAdmin;
  const meetingDate = parseISO(meeting.meeting_date);
  const isMeetingUpcoming = isFuture(meetingDate) || isToday(meetingDate);
  const userParticipation = participants?.find(p => p.user_id === currentUser?.id);

  const handleRespond = async (status: "accepted" | "rejected") => {
    if (!userParticipation) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("meeting_participants")
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq("id", userParticipation.id);

      if (error) throw error;

      // Mark notification as read
      await supabase
        .from("meeting_notifications")
        .update({ is_read: true })
        .eq("meeting_id", meeting.id)
        .eq("user_id", currentUser?.id);

      toast.success(status === "accepted" ? "Meeting diterima" : "Meeting ditolak");
      refetchParticipants();
      queryClient.invalidateQueries({ queryKey: ["meeting-notifications"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal merespon undangan");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({ status: newStatus })
        .eq("id", meeting.id);

      if (error) throw error;

      toast.success("Status meeting diperbarui");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui status");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500">Diterima</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  // Calculate meeting duration in minutes
  const calculateDuration = () => {
    const [startHour, startMin] = meeting.start_time.split(":").map(Number);
    const [endHour, endMin] = meeting.end_time.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  const duration = calculateDuration();
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {meeting.title}
            {meeting.type === "internal" ? (
              <Badge variant="outline" className="bg-purple-50 text-purple-700">Internal</Badge>
            ) : (
              <Badge variant="outline" className="bg-orange-50 text-orange-700">External</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Meeting Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(meetingDate, "EEEE, dd MMMM yyyy", { locale: id })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>
                {meeting.start_time.slice(0, 5)} - {meeting.end_time.slice(0, 5)}
                <span className="text-muted-foreground text-sm ml-2">
                  ({hours > 0 ? `${hours} jam ` : ""}{minutes > 0 ? `${minutes} menit` : ""})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {meeting.mode === "online" ? (
                <>
                  <Video className="w-4 h-4 text-muted-foreground" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>Offline</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>
                {(participants?.length || 0) + (externalParticipants?.length || 0)} partisipan
              </span>
            </div>
          </div>

          {/* Meeting Link/Location */}
          {meeting.mode === "online" && meeting.meeting_link && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  <span className="text-sm truncate max-w-[300px]">{meeting.meeting_link}</span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Buka
                  </a>
                </Button>
              </div>
            </div>
          )}

          {meeting.mode === "offline" && meeting.location && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{meeting.location}</span>
              </div>
            </div>
          )}

          {/* Client & Project */}
          {(meeting.client || meeting.project) && (
            <div className="flex gap-4">
              {meeting.client && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>Client: {meeting.client.name}</span>
                </div>
              )}
              {meeting.project && (
                <div className="flex items-center gap-2">
                  <span>Project: {meeting.project.title}</span>
                </div>
              )}
            </div>
          )}

          {/* User Response Section */}
          {userParticipation && isMeetingUpcoming && meeting.status !== "cancelled" && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-3">Status partisipasi Anda:</p>
              {userParticipation.status === "pending" ? (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleRespond("accepted")} 
                    disabled={isUpdating}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Terima
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleRespond("rejected")} 
                    disabled={isUpdating}
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Tolak
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {getStatusBadge(userParticipation.status)}
                  <span className="text-sm text-muted-foreground">
                    pada {format(parseISO(userParticipation.responded_at), "dd MMM yyyy HH:mm", { locale: id })}
                  </span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Participants Tabs */}
          <Tabs defaultValue="internal">
            <TabsList>
              <TabsTrigger value="internal">
                Internal ({participants?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="external">
                External ({externalParticipants?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="internal" className="mt-4">
              {participants?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada partisipan internal</p>
              ) : (
                <div className="space-y-2">
                  {participants?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{p.user?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{p.user?.email}</p>
                      </div>
                      {getStatusBadge(p.status)}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="external" className="mt-4">
              {externalParticipants?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada partisipan external</p>
              ) : (
                <div className="space-y-2">
                  {externalParticipants?.map((p) => (
                    <div key={p.id} className="p-2 border rounded">
                      <p className="font-medium">{p.name}</p>
                      {p.company && <p className="text-sm text-muted-foreground">{p.company}</p>}
                      {p.email && <p className="text-sm text-muted-foreground">{p.email}</p>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Notes */}
          {meeting.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Catatan</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{meeting.notes}</p>
              </div>
            </>
          )}

          {/* Creator Actions */}
          {canEdit && (
            <>
              <Separator />
              <div className="flex gap-2">
                {meeting.status === "scheduled" && (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => handleUpdateStatus("completed")}
                      disabled={isUpdating}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Tandai Selesai
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => handleUpdateStatus("cancelled")}
                      disabled={isUpdating}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Batalkan
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {/* Meeting Meta */}
          <div className="text-xs text-muted-foreground">
            <p>Dibuat oleh: {meeting.creator?.full_name}</p>
            <p>Pada: {format(parseISO(meeting.created_at), "dd MMM yyyy HH:mm", { locale: id })}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingDetailDialog;
