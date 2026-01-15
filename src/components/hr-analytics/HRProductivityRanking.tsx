import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Medal, Eye, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { parseISO, differenceInMinutes } from "date-fns";

interface HRProductivityRankingProps {
  profiles: any[];
  attendance: any[];
  tasks: any[];
  meetings: any[];
  shootings: any[];
  events: any[];
  onViewEmployee: (id: string) => void;
}

export function HRProductivityRanking({ 
  profiles, 
  attendance, 
  tasks, 
  meetings,
  shootings,
  events,
  onViewEmployee 
}: HRProductivityRankingProps) {
  const rankings = useMemo(() => {
    return profiles.map(profile => {
      const userAttendance = attendance.filter(a => a.user_id === profile.id);
      const userTasks = tasks.filter(t => 
        t.assigned_to === profile.id || 
        t.task_assignees?.some((a: any) => a.user_id === profile.id)
      );
      const userMeetings = meetings.filter(m => 
        m.created_by === profile.id ||
        m.meeting_participants?.some((p: any) => p.user_id === profile.id)
      );
      const userShootings = shootings.filter(s => 
        s.requested_by === profile.id ||
        s.director === profile.id ||
        s.runner === profile.id ||
        s.shooting_crew?.some((c: any) => c.user_id === profile.id)
      );
      const userEvents = events.filter(e => 
        e.created_by === profile.id ||
        e.pic_id === profile.id ||
        e.event_crew?.some((c: any) => c.user_id === profile.id)
      );

      // Calculate work hours
      const totalMinutes = userAttendance.reduce((sum, a) => {
        if (!a.clock_in || !a.clock_out) return sum;
        const minutes = differenceInMinutes(parseISO(a.clock_out), parseISO(a.clock_in));
        return sum + Math.max(0, minutes - (a.total_break_minutes || 0));
      }, 0);
      const workHours = Math.round(totalMinutes / 60 * 10) / 10;

      // Activities completed
      const tasksCompleted = userTasks.filter(t => 
        t.status === 'done' || t.status === 'completed'
      ).length;
      const totalActivities = tasksCompleted + userMeetings.length + userShootings.length + userEvents.length;

      // Overdue count
      const overdueCount = userTasks.filter(t => {
        if (!t.deadline) return false;
        if (t.status === 'done' || t.status === 'completed') return false;
        return new Date(t.deadline) < new Date();
      }).length;

      // Attendance consistency (days present)
      const daysPresent = userAttendance.filter(a => a.clock_in).length;

      // Auto clock-out count (lower is better)
      const autoClockoutCount = userAttendance.filter(a => 
        a.notes?.includes('[AUTO CLOCK-OUT')
      ).length;

      // Calculate productivity score
      // Higher activities = higher score
      // Lower overdue = higher score
      // Higher attendance = higher score
      // Lower auto clock-out = higher score
      const score = 
        (totalActivities * 10) + 
        (daysPresent * 5) + 
        (workHours * 0.5) -
        (overdueCount * 15) - 
        (autoClockoutCount * 10);

      return {
        profile,
        workHours,
        totalActivities,
        tasksCompleted,
        overdueCount,
        daysPresent,
        autoClockoutCount,
        score: Math.max(0, score),
      };
    }).sort((a, b) => b.score - a.score);
  }, [profiles, attendance, tasks, meetings, shootings, events]);

  const getRankBadge = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-medium">#{index + 1}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Productivity Ranking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Jam Kerja</TableHead>
                <TableHead className="text-right">Aktivitas</TableHead>
                <TableHead className="text-right">Hadir</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankings.map((item, index) => (
                <TableRow key={item.profile.id}>
                  <TableCell className="text-center">
                    {getRankBadge(index)}
                  </TableCell>
                  <TableCell className="font-medium">{item.profile.full_name}</TableCell>
                  <TableCell className="text-right">{item.workHours}h</TableCell>
                  <TableCell className="text-right">{item.totalActivities}</TableCell>
                  <TableCell className="text-right">{item.daysPresent} hari</TableCell>
                  <TableCell className="text-right">
                    {item.overdueCount > 0 ? (
                      <Badge variant="destructive">{item.overdueCount}</Badge>
                    ) : (
                      <Badge variant="secondary">0</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {Math.round(item.score)}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onViewEmployee(item.profile.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
