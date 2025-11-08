import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";

export function ClockInOut() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Get today's attendance record
  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ["today-attendance"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("date", today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const handleClockIn = async () => {
    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();

      const { error } = await supabase.from("attendance").insert({
        user_id: session.session.user.id,
        date: today,
        clock_in: now,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast.success("Clocked in successfully!");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to clock in");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance) return;

    try {
      setLoading(true);
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("attendance")
        .update({
          clock_out: now,
          notes: notes.trim() || todayAttendance.notes,
        })
        .eq("id", todayAttendance.id);

      if (error) throw error;

      toast.success("Clocked out successfully!");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to clock out");
    } finally {
      setLoading(false);
    }
  };

  const isClockedIn = todayAttendance?.clock_in && !todayAttendance?.clock_out;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Today's Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {todayAttendance?.clock_in && (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Clock In:</span>
              <span className="font-medium">
                {format(new Date(todayAttendance.clock_in), 'HH:mm:ss')}
              </span>
            </div>
            {todayAttendance.clock_out && (
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4 text-red-500" />
                <span className="text-muted-foreground">Clock Out:</span>
                <span className="font-medium">
                  {format(new Date(todayAttendance.clock_out), 'HH:mm:ss')}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add any notes about your work today..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        {!todayAttendance?.clock_in ? (
          <Button
            onClick={handleClockIn}
            disabled={loading}
            className="w-full gap-2"
          >
            <LogIn className="h-4 w-4" />
            Clock In
          </Button>
        ) : !todayAttendance.clock_out ? (
          <Button
            onClick={handleClockOut}
            disabled={loading}
            variant="destructive"
            className="w-full gap-2"
          >
            <LogOut className="h-4 w-4" />
            Clock Out
          </Button>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            You've completed your attendance for today
          </div>
        )}
      </CardContent>
    </Card>
  );
}
