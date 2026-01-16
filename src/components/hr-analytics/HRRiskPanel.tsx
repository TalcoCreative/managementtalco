import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Activity, Eye } from "lucide-react";
import { useMemo } from "react";
import { parseISO, differenceInMinutes } from "date-fns";

interface HRRiskPanelProps {
  profiles: any[];
  attendance: any[];
  tasks: any[];
  onViewEmployee: (id: string) => void;
}

export function HRRiskPanel({ profiles, attendance, tasks, onViewEmployee }: HRRiskPanelProps) {
  const insights = useMemo(() => {
    const results: {
      highAutoClockout: { profile: any; count: number }[];
      highHoursLowActivity: { profile: any; hours: number; activities: number }[];
      lowHoursHighActivity: { profile: any; hours: number; activities: number }[];
      highOverdue: { profile: any; count: number }[];
    } = {
      highAutoClockout: [],
      highHoursLowActivity: [],
      lowHoursHighActivity: [],
      highOverdue: [],
    };

    profiles.forEach(profile => {
      const userAttendance = attendance.filter(a => a.user_id === profile.id);
      const userTasks = tasks.filter(t => 
        t.assigned_to === profile.id || 
        t.task_assignees?.some((a: any) => a.user_id === profile.id)
      );

      // Auto clock-out count
      const autoClockoutCount = userAttendance.filter(a => 
        a.notes?.includes('[AUTO CLOCK-OUT')
      ).length;
      if (autoClockoutCount >= 3) {
        results.highAutoClockout.push({ profile, count: autoClockoutCount });
      }

      // Calculate work hours
      const totalMinutes = userAttendance.reduce((sum, a) => {
        if (!a.clock_in || !a.clock_out) return sum;
        const minutes = differenceInMinutes(parseISO(a.clock_out), parseISO(a.clock_in));
        return sum + Math.max(0, minutes - (a.total_break_minutes || 0));
      }, 0);
      const totalHours = Math.round(totalMinutes / 60);

      // Activity count (completed tasks)
      const completedTasks = userTasks.filter(t => 
        t.status === 'done' || t.status === 'completed'
      ).length;

      // High hours, low activity (>40 hours, <5 completed)
      if (totalHours > 40 && completedTasks < 5) {
        results.highHoursLowActivity.push({ 
          profile, 
          hours: totalHours, 
          activities: completedTasks 
        });
      }

      // Low hours, high activity (<20 hours, >10 completed)
      if (totalHours < 20 && totalHours > 0 && completedTasks > 10) {
        results.lowHoursHighActivity.push({ 
          profile, 
          hours: totalHours, 
          activities: completedTasks 
        });
      }

      // Overdue tasks
      const overdueCount = userTasks.filter(t => {
        if (!t.deadline) return false;
        if (t.status === 'done' || t.status === 'completed') return false;
        return new Date(t.deadline) < new Date();
      }).length;
      if (overdueCount >= 3) {
        results.highOverdue.push({ profile, count: overdueCount });
      }
    });

    // Sort by severity
    results.highAutoClockout.sort((a, b) => b.count - a.count);
    results.highOverdue.sort((a, b) => b.count - a.count);

    return results;
  }, [profiles, attendance, tasks]);

  const hasInsights = 
    insights.highAutoClockout.length > 0 ||
    insights.highHoursLowActivity.length > 0 ||
    insights.lowHoursHighActivity.length > 0 ||
    insights.highOverdue.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Risk & Bottleneck Panel
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasInsights ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>🎉 Tidak ada risiko yang terdeteksi</p>
            <p className="text-sm mt-1">Semua karyawan dalam kondisi baik</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {/* High Auto Clock-out */}
            {insights.highAutoClockout.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Sering Lupa Clock-out
                </h4>
                <div className="space-y-2">
                  {insights.highAutoClockout.map(item => (
                    <div 
                      key={item.profile.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.profile.full_name}</p>
                        <Badge variant="secondary" className="text-xs">
                          {item.count}x auto clock-out
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onViewEmployee(item.profile.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* High Hours Low Activity */}
            {insights.highHoursLowActivity.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Jam Tinggi, Aktivitas Rendah
                </h4>
                <div className="space-y-2">
                  {insights.highHoursLowActivity.map(item => (
                    <div 
                      key={item.profile.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.profile.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.hours}h kerja, {item.activities} aktivitas
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onViewEmployee(item.profile.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Hours High Activity */}
            {insights.lowHoursHighActivity.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  Aktivitas Tinggi, Jam Rendah
                </h4>
                <div className="space-y-2">
                  {insights.lowHoursHighActivity.map(item => (
                    <div 
                      key={item.profile.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.profile.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.hours}h kerja, {item.activities} aktivitas
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onViewEmployee(item.profile.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* High Overdue */}
            {insights.highOverdue.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Task Overdue Terbanyak
                </h4>
                <div className="space-y-2">
                  {insights.highOverdue.map(item => (
                    <div 
                      key={item.profile.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.profile.full_name}</p>
                        <Badge variant="destructive" className="text-xs">
                          {item.count} task overdue
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onViewEmployee(item.profile.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
