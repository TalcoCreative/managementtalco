import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RescheduleShootingDialogProps {
  shooting: {
    id: string;
    title: string;
    scheduled_date: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleShootingDialog({
  shooting,
  open,
  onOpenChange,
}: RescheduleShootingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const handleReschedule = async () => {
    if (!shooting || !newDate || !newTime || !reason.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      // Update shooting with new date and store original
      const { error: updateError } = await supabase
        .from("shooting_schedules")
        .update({
          original_date: shooting.scheduled_date,
          rescheduled_from: shooting.scheduled_date,
          scheduled_date: newDate,
          scheduled_time: newTime,
          reschedule_reason: reason.trim(),
          status: "pending", // Reset to pending for re-approval
        })
        .eq("id", shooting.id);

      if (updateError) throw updateError;

      // Reset all notifications for this shooting to pending
      const { error: notifError } = await supabase
        .from("shooting_notifications")
        .update({ status: "pending", responded_at: null })
        .eq("shooting_id", shooting.id);

      if (notifError) throw notifError;

      // Update linked task deadline
      const { data: shootingData } = await supabase
        .from("shooting_schedules")
        .select("task_id")
        .eq("id", shooting.id)
        .single();

      if (shootingData?.task_id) {
        await supabase
          .from("tasks")
          .update({ deadline: newDate })
          .eq("id", shootingData.task_id);
      }

      toast.success("Shooting rescheduled! Waiting for crew re-approval.");
      onOpenChange(false);
      setNewDate("");
      setNewTime("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-notifications"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to reschedule");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!shooting || !reason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("shooting_schedules")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason.trim(),
        })
        .eq("id", shooting.id);

      if (updateError) throw updateError;

      // Update linked task to on_hold
      const { data: shootingData } = await supabase
        .from("shooting_schedules")
        .select("task_id")
        .eq("id", shooting.id)
        .single();

      if (shootingData?.task_id) {
        await supabase
          .from("tasks")
          .update({ status: "on_hold" })
          .eq("id", shootingData.task_id);
      }

      toast.success("Shooting cancelled");
      onOpenChange(false);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-notifications"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel");
    } finally {
      setLoading(false);
    }
  };

  if (!shooting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule / Cancel Shooting</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Shooting: <strong>{shooting.title}</strong>
            <br />
            Current date: {new Date(shooting.scheduled_date).toLocaleDateString()}
          </p>

          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              placeholder="Explain why you need to reschedule or cancel..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Reschedule to new date</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>New Time</Label>
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full mt-3"
              onClick={handleReschedule}
              disabled={loading || !newDate || !newTime || !reason.trim()}
            >
              {loading ? "Processing..." : "Reschedule"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              All crew members will need to re-approve.
            </p>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 text-destructive">Cancel Shooting</h4>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleCancel}
              disabled={loading || !reason.trim()}
            >
              {loading ? "Processing..." : "Cancel Shooting"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
