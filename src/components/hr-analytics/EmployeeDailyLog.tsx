import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface EmployeeDailyLogProps {
  attendance: any[];
  tasks: any[];
  meetings: any[];
  shootings: any[];
  events: any[];
  employeeId: string;
}

export function EmployeeDailyLog({ attendance, tasks, meetings, shootings, events }: EmployeeDailyLogProps) {
  const formatTime = (t: string | null) => t ? format(parseISO(t), 'HH:mm') : '-';

  return (
    <Card>
      <CardHeader><CardTitle>Log Aktivitas Harian</CardTitle></CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead><TableHead>Masuk</TableHead><TableHead>Pulang</TableHead><TableHead>Break</TableHead><TableHead>Aktivitas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map(a => {
                const dateStr = a.date;
                const dayTasks = tasks.filter(t => t.created_at?.startsWith(dateStr) || t.deadline?.startsWith(dateStr)).length;
                const dayMeetings = meetings.filter(m => m.meeting_date === dateStr).length;
                const dayShootings = shootings.filter(s => s.scheduled_date === dateStr).length;
                const dayEvents = events.filter(e => e.start_date <= dateStr && e.end_date >= dateStr).length;
                const isAutoClockout = a.notes?.includes('[AUTO CLOCK-OUT');
                
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{format(new Date(a.date), 'dd MMM yyyy', { locale: idLocale })}</TableCell>
                    <TableCell>{formatTime(a.clock_in)}</TableCell>
                    <TableCell>
                      {formatTime(a.clock_out)}
                      {isAutoClockout && <Badge variant="secondary" className="ml-1 text-xs">Auto</Badge>}
                    </TableCell>
                    <TableCell>{a.total_break_minutes || 0}m</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {dayTasks > 0 && <Badge variant="outline">{dayTasks} task</Badge>}
                        {dayMeetings > 0 && <Badge variant="outline">{dayMeetings} meet</Badge>}
                        {dayShootings > 0 && <Badge variant="outline">{dayShootings} shoot</Badge>}
                        {dayEvents > 0 && <Badge variant="outline">{dayEvents} event</Badge>}
                        {dayTasks + dayMeetings + dayShootings + dayEvents === 0 && <span className="text-muted-foreground text-sm">-</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
