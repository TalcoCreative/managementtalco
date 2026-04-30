import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Camera, Clock, AlertTriangle, CheckCircle2, RotateCcw, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type PendingItem = {
  kind: "meeting" | "shooting";
  id: string;
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
};

interface RescheduleState {
  open: boolean;
  item: PendingItem | null;
  newDate: string;
  newTime: string;
  reason: string;
}

export function PendingCompletionPopup({ userId }: { userId?: string | null }) {
  const qc = useQueryClient();
  const [reschedule, setReschedule] = useState<RescheduleState>({
    open: false,
    item: null,
    newDate: "",
    newTime: "",
    reason: "",
  });

  const { data: pendingMeetings = [] } = useQuery({
    queryKey: ["pending-meetings", userId],
    enabled: !!userId,
    refetchInterval: 60000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, meeting_date, end_time, location, completion_status, status")
        .eq("created_by", userId!)
        .lte("meeting_date", today)
        .in("completion_status", ["pending"])
        .not("status", "in", "(cancelled,completed)")
        .order("meeting_date", { ascending: true });
      if (error) throw error;
      const now = new Date();
      return (data || []).filter((m: any) => {
        const end = new Date(`${m.meeting_date}T${m.end_time || "23:59"}:00`);
        return end <= now;
      });
    },
  });

  const { data: pendingShootings = [] } = useQuery({
    queryKey: ["pending-shootings", userId],
    enabled: !!userId,
    refetchInterval: 60000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select("id, title, scheduled_date, scheduled_time, location, completion_status, status")
        .eq("requested_by", userId!)
        .lte("scheduled_date", today)
        .in("completion_status", ["pending"])
        .not("status", "in", "(cancelled,rejected)")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      const now = new Date();
      return (data || []).filter((s: any) => {
        const end = new Date(`${s.scheduled_date}T${s.scheduled_time || "23:59"}:00`);
        return end <= now;
      });
    },
  });

  const items: PendingItem[] = [
    ...pendingMeetings.map((m: any) => ({
      kind: "meeting" as const,
      id: m.id,
      title: m.title,
      date: m.meeting_date,
      time: m.end_time,
      location: m.location,
    })),
    ...pendingShootings.map((s: any) => ({
      kind: "shooting" as const,
      id: s.id,
      title: s.title,
      date: s.scheduled_date,
      time: s.scheduled_time,
      location: s.location,
    })),
  ];

  if (items.length === 0) return null;

  const tableOf = (k: "meeting" | "shooting") =>
    k === "meeting" ? "meetings" : "shooting_schedules";

  const markCompleted = async (it: PendingItem) => {
    const { error } = await supabase
      .from(tableOf(it.kind) as any)
      .update({
        completion_status: "completed",
        completion_confirmed_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", it.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${it.kind === "meeting" ? "Meeting" : "Shooting"} ditandai selesai`);
    qc.invalidateQueries({ queryKey: ["pending-meetings", userId] });
    qc.invalidateQueries({ queryKey: ["pending-shootings", userId] });
  };

  const markCancelled = async (it: PendingItem) => {
    const { error } = await supabase
      .from(tableOf(it.kind) as any)
      .update({
        completion_status: "cancelled",
        completion_confirmed_at: new Date().toISOString(),
        status: "cancelled",
      })
      .eq("id", it.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ditandai cancelled");
    qc.invalidateQueries({ queryKey: ["pending-meetings", userId] });
    qc.invalidateQueries({ queryKey: ["pending-shootings", userId] });
  };

  const submitReschedule = async () => {
    const it = reschedule.item;
    if (!it || !reschedule.newDate) {
      toast.error("Tanggal baru wajib diisi");
      return;
    }
    const patch: any = {
      completion_status: "rescheduled",
      completion_confirmed_at: new Date().toISOString(),
      status: "rescheduled",
      reschedule_reason: reschedule.reason || null,
      rescheduled_at: new Date().toISOString(),
    };
    if (it.kind === "meeting") {
      patch.original_date = it.date;
      patch.meeting_date = reschedule.newDate;
      if (reschedule.newTime) patch.start_time = reschedule.newTime;
    } else {
      patch.original_date = it.date;
      patch.rescheduled_from = it.date;
      patch.scheduled_date = reschedule.newDate;
      if (reschedule.newTime) patch.scheduled_time = reschedule.newTime;
    }

    const { error } = await supabase.from(tableOf(it.kind) as any).update(patch).eq("id", it.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reschedule disimpan");
    setReschedule({ open: false, item: null, newDate: "", newTime: "", reason: "" });
    qc.invalidateQueries({ queryKey: ["pending-meetings", userId] });
    qc.invalidateQueries({ queryKey: ["pending-shootings", userId] });
  };

  return (
    <>
      <Card className="border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-sm sm:text-base">
              Konfirmasi {items.length} jadwal yang sudah lewat
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Tandai apakah meeting/shooting di bawah sudah selesai, di-reschedule, atau dibatalkan.
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {items.map((it) => (
              <div
                key={`${it.kind}-${it.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-background/80 backdrop-blur p-3 border border-border/60"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    {it.kind === "meeting" ? (
                      <Calendar className="h-4 w-4 text-purple-600" />
                    ) : (
                      <Camera className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{it.title}</p>
                      <Badge variant="outline" className="text-[10px] h-5 capitalize">
                        {it.kind}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(it.date), "dd MMM yyyy")}
                      {it.time ? ` • ${String(it.time).slice(0, 5)}` : ""}
                      {it.location ? ` • ${it.location}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Button size="sm" variant="default" className="h-8" onClick={() => markCompleted(it)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Selesai
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() =>
                      setReschedule({
                        open: true,
                        item: it,
                        newDate: "",
                        newTime: "",
                        reason: "",
                      })
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-destructive"
                    onClick={() => markCancelled(it)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Batal
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={reschedule.open}
        onOpenChange={(o) => !o && setReschedule({ ...reschedule, open: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule {reschedule.item?.kind}</DialogTitle>
            <DialogDescription>
              {reschedule.item?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tanggal baru *</Label>
                <Input
                  type="date"
                  value={reschedule.newDate}
                  onChange={(e) => setReschedule({ ...reschedule, newDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Jam (opsional)</Label>
                <Input
                  type="time"
                  value={reschedule.newTime}
                  onChange={(e) => setReschedule({ ...reschedule, newTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Alasan</Label>
              <Textarea
                rows={2}
                value={reschedule.reason}
                onChange={(e) => setReschedule({ ...reschedule, reason: e.target.value })}
                placeholder="Kenapa di-reschedule?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule({ ...reschedule, open: false })}>
              Batal
            </Button>
            <Button onClick={submitReschedule}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
