import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Check, X, Video, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const MeetingInvitationNotifications = () => {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: pendingInvitations } = useQuery({
    queryKey: ["pending-meeting-invitations", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];

      const { data, error } = await supabase
        .from("meeting_participants")
        .select(`
          *,
          meeting:meetings(
            id, title, meeting_date, start_time, end_time, mode, location, meeting_link,
            creator:created_by(full_name)
          )
        `)
        .eq("user_id", currentUser.id)
        .eq("status", "pending")
        .gte("meeting.meeting_date", new Date().toISOString().split("T")[0]);

      if (error) throw error;
      return data?.filter(d => d.meeting) || [];
    },
    enabled: !!currentUser?.id,
  });

  const handleAccept = async (participantId: string, meetingId: string) => {
    setIsUpdating(participantId);
    try {
      const { error } = await supabase
        .from("meeting_participants")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", participantId);

      if (error) throw error;

      await supabase
        .from("meeting_notifications")
        .update({ is_read: true })
        .eq("meeting_id", meetingId)
        .eq("user_id", currentUser?.id);

      toast.success("Undangan meeting diterima");
      queryClient.invalidateQueries({ queryKey: ["pending-meeting-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-notifications"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menerima undangan");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRejectClick = (invitation: any) => {
    setSelectedInvitation(invitation);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Mohon isi alasan menolak");
      return;
    }

    setIsUpdating(selectedInvitation.id);
    try {
      const { error } = await supabase
        .from("meeting_participants")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq("id", selectedInvitation.id);

      if (error) throw error;

      await supabase
        .from("meeting_notifications")
        .update({ is_read: true })
        .eq("meeting_id", selectedInvitation.meeting_id)
        .eq("user_id", currentUser?.id);

      toast.success("Undangan meeting ditolak");
      setShowRejectDialog(false);
      setSelectedInvitation(null);
      queryClient.invalidateQueries({ queryKey: ["pending-meeting-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-notifications"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menolak undangan");
    } finally {
      setIsUpdating(null);
    }
  };

  if (!pendingInvitations || pendingInvitations.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
            Undangan Meeting
            <Badge variant="secondary" className="ml-2">
              {pendingInvitations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingInvitations.map((invitation) => (
            <div
              key={invitation.id}
              className="p-3 bg-background border rounded-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{invitation.meeting?.title}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(parseISO(invitation.meeting?.meeting_date), "EEE, dd MMM yyyy", { locale: id })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {invitation.meeting?.start_time?.slice(0, 5)} - {invitation.meeting?.end_time?.slice(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      {invitation.meeting?.mode === "online" ? (
                        <Video className="h-3.5 w-3.5" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5" />
                      )}
                      {invitation.meeting?.mode === "online" ? "Online" : invitation.meeting?.location || "Offline"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dari: {invitation.meeting?.creator?.full_name}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(invitation.id, invitation.meeting_id)}
                    disabled={isUpdating === invitation.id}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Terima
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectClick(invitation)}
                    disabled={isUpdating === invitation.id}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Tolak
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Undangan Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anda akan menolak undangan meeting: <strong>{selectedInvitation?.meeting?.title}</strong>
            </p>
            <div>
              <label className="text-sm font-medium">Alasan Menolak *</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Masukkan alasan mengapa Anda tidak bisa hadir..."
                rows={3}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectConfirm}
              disabled={isUpdating === selectedInvitation?.id}
            >
              Konfirmasi Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
