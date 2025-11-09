import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, Camera, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export function ClockInOut() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoClockIn, setPhotoClockIn] = useState<string | null>(null);
  const [photoClockOut, setPhotoClockOut] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraForClockIn, setIsCameraForClockIn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  // Get today's tasks for the user
  const { data: todayTasks } = useQuery({
    queryKey: ["today-tasks"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title)")
        .eq("assigned_to", session.session.user.id)
        .gte("requested_at", `${today}T00:00:00`)
        .lte("requested_at", `${today}T23:59:59`);

      if (error) throw error;
      return data;
    },
  });

  // Get today's created tasks
  const { data: createdTasks } = useQuery({
    queryKey: ["today-created-tasks"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title)")
        .eq("created_by", session.session.user.id)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      if (error) throw error;
      return data;
    },
  });

  const startCamera = async (forClockIn: boolean) => {
    try {
      setIsCameraForClockIn(forClockIn);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      toast.error("Could not access camera");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const photoData = canvas.toDataURL('image/jpeg', 0.8);

    if (isCameraForClockIn) {
      setPhotoClockIn(photoData);
    } else {
      setPhotoClockOut(photoData);
    }
    
    stopCamera();
    toast.success("Photo captured!");
  };

  const handleClockIn = async () => {
    if (!photoClockIn) {
      toast.error("Please take a photo before clocking in");
      return;
    }

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
        photo_clock_in: photoClockIn,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast.success("Clocked in successfully!");
      setNotes("");
      setPhotoClockIn(null);
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to clock in");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance) return;
    if (!photoClockOut) {
      toast.error("Please take a photo before clocking out");
      return;
    }

    try {
      setLoading(true);
      const now = new Date().toISOString();

      // Compile all tasks completed today
      const allTasks = [
        ...(todayTasks || []).map(t => `Assigned: ${t.title}`),
        ...(createdTasks || []).map(t => `Created: ${t.title}`)
      ];

      const { error } = await supabase
        .from("attendance")
        .update({
          clock_out: now,
          photo_clock_out: photoClockOut,
          tasks_completed: allTasks,
          notes: notes.trim() || todayAttendance.notes,
        })
        .eq("id", todayAttendance.id);

      if (error) throw error;

      toast.success("Clocked out successfully!");
      setNotes("");
      setPhotoClockOut(null);
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["today-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["today-created-tasks"] });
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
        {showCamera && (
          <div className="space-y-4">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline
              className="w-full rounded-lg border"
            />
            <div className="flex gap-2">
              <Button onClick={capturePhoto} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Capture Photo
              </Button>
              <Button onClick={stopCamera} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {todayAttendance?.clock_in && (
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Clock In:</span>
              <span className="font-medium">
                {format(new Date(todayAttendance.clock_in), 'HH:mm:ss')}
              </span>
            </div>
            {todayAttendance.photo_clock_in && (
              <img 
                src={todayAttendance.photo_clock_in} 
                alt="Clock in photo" 
                className="w-24 h-24 object-cover rounded border"
              />
            )}
            {todayAttendance.clock_out && (
              <>
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">Clock Out:</span>
                  <span className="font-medium">
                    {format(new Date(todayAttendance.clock_out), 'HH:mm:ss')}
                  </span>
                </div>
                {todayAttendance.photo_clock_out && (
                  <img 
                    src={todayAttendance.photo_clock_out} 
                    alt="Clock out photo" 
                    className="w-24 h-24 object-cover rounded border"
                  />
                )}
                {todayAttendance.tasks_completed && todayAttendance.tasks_completed.length > 0 && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <p className="font-medium mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Today's Work:
                    </p>
                    <ul className="space-y-1 text-sm">
                      {todayAttendance.tasks_completed.map((task: string, idx: number) => (
                        <li key={idx} className="text-muted-foreground">• {task}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!todayAttendance?.clock_out && (
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
        )}

        {!todayAttendance?.clock_in ? (
          <div className="space-y-2">
            {photoClockIn ? (
              <>
                <img 
                  src={photoClockIn} 
                  alt="Clock in preview" 
                  className="w-full h-48 object-cover rounded border"
                />
                <Button
                  onClick={() => startCamera(true)}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Retake Photo
                </Button>
              </>
            ) : (
              <Button
                onClick={() => startCamera(true)}
                variant="outline"
                className="w-full gap-2"
              >
                <Camera className="h-4 w-4" />
                Take Clock In Photo
              </Button>
            )}
            <Button
              onClick={handleClockIn}
              disabled={loading || !photoClockIn}
              className="w-full gap-2"
            >
              <LogIn className="h-4 w-4" />
              Clock In
            </Button>
          </div>
        ) : !todayAttendance.clock_out ? (
          <div className="space-y-2">
            {photoClockOut ? (
              <>
                <img 
                  src={photoClockOut} 
                  alt="Clock out preview" 
                  className="w-full h-48 object-cover rounded border"
                />
                <Button
                  onClick={() => startCamera(false)}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Retake Photo
                </Button>
              </>
            ) : (
              <Button
                onClick={() => startCamera(false)}
                variant="outline"
                className="w-full gap-2"
              >
                <Camera className="h-4 w-4" />
                Take Clock Out Photo
              </Button>
            )}
            <Button
              onClick={handleClockOut}
              disabled={loading || !photoClockOut}
              variant="destructive"
              className="w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Clock Out
            </Button>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            You've completed your attendance for today
          </div>
        )}
      </CardContent>
    </Card>
  );
}
