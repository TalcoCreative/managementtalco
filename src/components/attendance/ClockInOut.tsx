import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, Camera, CheckCircle2, CalendarOff, Video, Loader2, Coffee, Play, Square } from "lucide-react";
import { format, isAfter, set, differenceInMinutes } from "date-fns";
import { AutoClockoutNotification } from "./AutoClockoutNotification";

export function ClockInOut() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoClockIn, setPhotoClockIn] = useState<string | null>(null);
  const [photoClockOut, setPhotoClockOut] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraForClockIn, setIsCameraForClockIn] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakLoading, setBreakLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  const today = format(new Date(), 'yyyy-MM-dd');

  // Check if user has approved leave today
  const { data: approvedLeave } = useQuery({
    queryKey: ["approved-leave-today"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Get today's attendance record
  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ["today-attendance"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

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

  // Add timestamp watermark to photo
  const addTimestampToPhoto = useCallback((videoElement: HTMLVideoElement): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw the video frame
    ctx.drawImage(videoElement, 0, 0);

    // Create timestamp text
    const now = new Date();
    const dateStr = format(now, 'dd MMM yyyy');
    const timeStr = format(now, 'HH:mm:ss');
    const timestampText = `${dateStr} | ${timeStr}`;

    // Configure text style for watermark
    const fontSize = Math.max(16, Math.floor(canvas.width / 25));
    ctx.font = `bold ${fontSize}px Arial`;
    
    // Measure text width
    const textMetrics = ctx.measureText(timestampText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    
    // Position at bottom-right with padding
    const padding = 15;
    const x = canvas.width - textWidth - padding;
    const y = canvas.height - padding;

    // Draw semi-transparent background
    const bgPadding = 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(
      x - bgPadding, 
      y - textHeight - bgPadding / 2, 
      textWidth + bgPadding * 2, 
      textHeight + bgPadding
    );

    // Draw timestamp text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(timestampText, x, y);

    // Add "Talco Management System" label
    const labelFontSize = Math.max(12, Math.floor(canvas.width / 35));
    ctx.font = `${labelFontSize}px Arial`;
    const labelText = 'Talco Management System';
    const labelMetrics = ctx.measureText(labelText);
    const labelX = padding;
    const labelY = canvas.height - padding;

    // Draw label background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(
      labelX - bgPadding, 
      labelY - labelFontSize - bgPadding / 2, 
      labelMetrics.width + bgPadding * 2, 
      labelFontSize + bgPadding
    );

    // Draw label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, labelX, labelY);

    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const startCamera = async (forClockIn: boolean) => {
    try {
      setIsCameraForClockIn(forClockIn);
      setIsCameraReady(false);
      
      // Request camera with preference for front camera on mobile
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsCameraReady(true);
          // Start auto-capture countdown on mobile
          if (isMobile()) {
            startAutoCapture();
          }
        };
      }
      
      setShowCamera(true);
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.");
    }
  };

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const startAutoCapture = () => {
    // 3 second countdown before auto-capture
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Auto capture
      capturePhoto();
      setCountdown(null);
    }
  }, [countdown]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setIsCameraReady(false);
    setCountdown(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !isCameraReady) return;

    const photoData = addTimestampToPhoto(videoRef.current);
    
    if (!photoData) {
      toast.error("Gagal mengambil foto");
      return;
    }

    if (isCameraForClockIn) {
      setPhotoClockIn(photoData);
    } else {
      setPhotoClockOut(photoData);
    }
    
    stopCamera();
    toast.success("Foto berhasil diambil!");
  };

  const handleClockIn = async () => {
    if (!photoClockIn) {
      toast.error("Silakan ambil foto terlebih dahulu");
      return;
    }

    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      const { error } = await supabase.from("attendance").insert({
        user_id: session.session.user.id,
        date: today,
        clock_in: now,
        photo_clock_in: photoClockIn,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast.success("Clock in berhasil!");
      setNotes("");
      setPhotoClockIn(null);
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal clock in");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance) return;
    if (!photoClockOut) {
      toast.error("Silakan ambil foto terlebih dahulu");
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

      toast.success("Clock out berhasil!");
      setNotes("");
      setPhotoClockOut(null);
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["today-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["today-created-tasks"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal clock out");
    } finally {
      setLoading(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Auto clock-out at midnight
  useEffect(() => {
    const checkMidnight = async () => {
      const now = new Date();
      const midnight = set(now, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
      
      // If it's past midnight and we have an active clock-in from yesterday
      if (todayAttendance?.clock_in && !todayAttendance?.clock_out) {
        const clockInDate = new Date(todayAttendance.clock_in);
        const clockInDay = format(clockInDate, 'yyyy-MM-dd');
        const currentDay = format(now, 'yyyy-MM-dd');
        
        // If clock-in was from a previous day, auto clock-out
        if (clockInDay !== currentDay) {
          try {
            // Set clock out to 23:59:59 of the clock-in day
            const autoClockOutTime = set(clockInDate, { hours: 23, minutes: 59, seconds: 59 });
            
            await supabase
              .from("attendance")
              .update({
                clock_out: autoClockOutTime.toISOString(),
                notes: (todayAttendance.notes || "") + " [Auto clock-out at midnight]",
              })
              .eq("id", todayAttendance.id);
            
            toast.info("Clock out otomatis karena melewati jam 12 malam");
            queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
          } catch (error) {
            console.error("Auto clock-out error:", error);
          }
        }
      }
    };

    checkMidnight();
    
    // Check every minute for midnight
    const interval = setInterval(checkMidnight, 60000);
    return () => clearInterval(interval);
  }, [todayAttendance, queryClient]);

  // Handle break start
  const handleBreakStart = async () => {
    if (!todayAttendance) return;
    
    setBreakLoading(true);
    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from("attendance")
        .update({ break_start: now })
        .eq("id", todayAttendance.id);

      if (error) throw error;

      setIsOnBreak(true);
      toast.success("Break started!");
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to start break");
    } finally {
      setBreakLoading(false);
    }
  };

  // Handle break end
  const handleBreakEnd = async () => {
    if (!todayAttendance || !todayAttendance.break_start) return;
    
    setBreakLoading(true);
    try {
      const now = new Date();
      const breakStart = new Date(todayAttendance.break_start);
      const breakMinutes = differenceInMinutes(now, breakStart);
      const totalBreak = (todayAttendance.total_break_minutes || 0) + breakMinutes;
      
      const { error } = await supabase
        .from("attendance")
        .update({
          break_end: now.toISOString(),
          total_break_minutes: totalBreak,
          break_start: null, // Reset break_start for next break
        })
        .eq("id", todayAttendance.id);

      if (error) throw error;

      setIsOnBreak(false);
      toast.success(`Break ended! (${breakMinutes} minutes)`);
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to end break");
    } finally {
      setBreakLoading(false);
    }
  };

  // Check if currently on break
  useEffect(() => {
    if (todayAttendance?.break_start && !todayAttendance?.break_end) {
      setIsOnBreak(true);
    } else {
      setIsOnBreak(false);
    }
  }, [todayAttendance]);

  const isClockedIn = todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const hasApprovedLeave = !!approvedLeave;

  // If user has approved leave today, show leave notice
  if (hasApprovedLeave) {
    const leaveTypeLabel = approvedLeave.leave_type === 'sakit' ? 'Sakit' : 
                          approvedLeave.leave_type === 'cuti' ? 'Cuti' : 'Izin';
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <CalendarOff className="h-12 w-12 text-blue-500" />
            <div>
              <p className="font-medium text-lg">You're on {leaveTypeLabel} today</p>
              <p className="text-sm text-muted-foreground">
                Your leave has been approved. No need to clock in.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Today's Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-clockout notifications */}
        <AutoClockoutNotification />

        {showCamera && (
          <div className="space-y-4">
            <div className="relative">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted
                className="w-full rounded-lg border aspect-video object-cover"
              />
              
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {format(new Date(), 'dd MMM yyyy | HH:mm:ss')}
              </div>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                Talco Management System
              </div>

              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="text-6xl font-bold text-white animate-pulse">
                    {countdown}
                  </div>
                </div>
              )}

              {!isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-sm">Memuat kamera...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={capturePhoto} 
                className="flex-1 h-12 text-base"
                disabled={!isCameraReady}
              >
                <Camera className="h-5 w-5 mr-2" />
                {countdown !== null ? `Mengambil dalam ${countdown}...` : 'Ambil Foto'}
              </Button>
              <Button onClick={stopCamera} variant="outline" className="h-12 px-4">
                Batal
              </Button>
            </div>

            {isMobile() && isCameraReady && countdown === null && (
              <p className="text-sm text-center text-muted-foreground">
                Foto akan diambil otomatis dalam 3 detik, atau tekan tombol untuk mengambil sekarang
              </p>
            )}
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
                className="w-full max-w-xs h-auto object-cover rounded border"
              />
            )}
            
            {/* Break time info */}
            {(todayAttendance.total_break_minutes || 0) > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Coffee className="h-4 w-4 text-amber-500" />
                <span>Total Break: {todayAttendance.total_break_minutes} menit</span>
              </div>
            )}

            {todayAttendance.clock_out && (
              <>
                <div className="flex items-center gap-2 mt-3">
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
                    className="w-full max-w-xs h-auto object-cover rounded border"
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

        {/* Break button - only show when clocked in but not clocked out */}
        {isClockedIn && !showCamera && (
          <div className="border rounded-lg p-3 bg-muted/50">
            {isOnBreak ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Coffee className="h-4 w-4 animate-pulse" />
                  <span className="text-sm font-medium">On Break</span>
                </div>
                <Button
                  onClick={handleBreakEnd}
                  disabled={breakLoading}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {breakLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  End Break
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleBreakStart}
                disabled={breakLoading}
                variant="outline"
                className="w-full gap-2"
              >
                {breakLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <Coffee className="h-4 w-4" />
                Start Break
              </Button>
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
          <div className="space-y-3">
            {photoClockIn ? (
              <>
                <img 
                  src={photoClockIn} 
                  alt="Clock in preview" 
                  className="w-full h-auto max-h-64 object-contain rounded border bg-muted"
                />
                <Button
                  onClick={() => startCamera(true)}
                  variant="outline"
                  className="w-full gap-2 h-12 text-base"
                >
                  <Camera className="h-5 w-5" />
                  Ambil Ulang Foto
                </Button>
              </>
            ) : (
              <Button
                onClick={() => startCamera(true)}
                variant="outline"
                className="w-full gap-2 h-12 text-base"
              >
                <Video className="h-5 w-5" />
                Buka Kamera untuk Clock In
              </Button>
            )}
            <Button
              onClick={handleClockIn}
              disabled={loading || !photoClockIn}
              className="w-full gap-2 h-14 text-lg font-semibold"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              Clock In
            </Button>
          </div>
        ) : !todayAttendance.clock_out ? (
          <div className="space-y-3">
            {photoClockOut ? (
              <>
                <img 
                  src={photoClockOut} 
                  alt="Clock out preview" 
                  className="w-full h-auto max-h-64 object-contain rounded border bg-muted"
                />
                <Button
                  onClick={() => startCamera(false)}
                  variant="outline"
                  className="w-full gap-2 h-12 text-base"
                >
                  <Camera className="h-5 w-5" />
                  Ambil Ulang Foto
                </Button>
              </>
            ) : (
              <Button
                onClick={() => startCamera(false)}
                variant="outline"
                className="w-full gap-2 h-12 text-base"
              >
                <Video className="h-5 w-5" />
                Buka Kamera untuk Clock Out
              </Button>
            )}
            <Button
              onClick={handleClockOut}
              disabled={loading || !photoClockOut || isOnBreak}
              variant="destructive"
              className="w-full gap-2 h-14 text-lg font-semibold"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
              Clock Out
            </Button>
            {isOnBreak && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                End your break before clocking out
              </p>
            )}
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
