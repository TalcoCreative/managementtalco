import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";

interface LeaveApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: any;
}

export function LeaveApprovalDialog({ open, onOpenChange, request }: LeaveApprovalDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case "sakit":
        return <Badge className="bg-red-500">Sakit</Badge>;
      case "cuti":
        return <Badge className="bg-blue-500">Cuti</Badge>;
      case "izin":
        return <Badge className="bg-yellow-500">Izin</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          approved_by: session.session.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast.success("Leave request approved");
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["approved-leave-today"] });
      queryClient.invalidateQueries({ queryKey: ["hr-pending-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-all-leave-requests"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to approve request");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "rejected",
          approved_by: session.session.user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast.success("Leave request rejected");
      queryClient.invalidateQueries({ queryKey: ["my-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-pending-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-all-leave-requests"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to reject request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review Leave Request</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Employee</Label>
            <p className="font-medium">{request.profiles?.full_name || "Unknown"}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Leave Type</Label>
            <div>{getLeaveTypeBadge(request.leave_type)}</div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Date Range</Label>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(request.start_date), "dd MMM yyyy", { locale: idLocale })}
                {request.start_date !== request.end_date && (
                  <> - {format(new Date(request.end_date), "dd MMM yyyy", { locale: idLocale })}</>
                )}
              </span>
            </div>
          </div>

          {request.reason && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Reason</Label>
              <p className="text-sm">{request.reason}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Rejection Reason (required if rejecting)</Label>
            <Textarea
              placeholder="Enter reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 bg-green-500 hover:bg-green-600"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              onClick={handleReject}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
