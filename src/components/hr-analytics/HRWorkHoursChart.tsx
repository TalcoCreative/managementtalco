import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMemo } from "react";

interface HRWorkHoursChartProps {
  attendance: any[];
  tasks: any[];
  meetings: any[];
  shootings: any[];
  events: any[];
  startDate: string;
  endDate: string;
}

export function HRWorkHoursChart({ 
  attendance, 
  tasks, 
  meetings, 
  shootings, 
  events,
  startDate, 
  endDate 
}: HRWorkHoursChartProps) {
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({
      start: new Date(startDate),
      end: new Date(endDate)
    });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'dd MMM', { locale: idLocale });

      // Calculate work hours for this day
      const dayAttendance = attendance.filter(a => a.date === dateStr);
      let totalMinutes = 0;
      dayAttendance.forEach(a => {
        if (a.clock_in && a.clock_out) {
          const clockIn = parseISO(a.clock_in);
          const clockOut = parseISO(a.clock_out);
          const minutes = (clockOut.getTime() - clockIn.getTime()) / 1000 / 60;
          totalMinutes += Math.max(0, minutes - (a.total_break_minutes || 0));
        }
      });
      const workHours = Math.round(totalMinutes / 60 * 10) / 10;

      // Count activities for this day
      const taskCount = tasks.filter(t => 
        t.created_at?.startsWith(dateStr) || t.deadline?.startsWith(dateStr)
      ).length;
      const meetingCount = meetings.filter(m => m.meeting_date === dateStr).length;
      const shootingCount = shootings.filter(s => s.scheduled_date === dateStr).length;
      const eventCount = events.filter(e => 
        e.start_date <= dateStr && e.end_date >= dateStr
      ).length;
      const totalActivities = taskCount + meetingCount + shootingCount + eventCount;

      return {
        date: dayLabel,
        jamKerja: workHours,
        aktivitas: totalActivities,
      };
    });
  }, [attendance, tasks, meetings, shootings, events, startDate, endDate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jam Kerja vs Aktivitas Harian</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              label={{ value: 'Jam', angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              label={{ value: 'Aktivitas', angle: 90, position: 'insideRight', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="jamKerja" 
              fill="hsl(var(--primary))" 
              name="Jam Kerja"
              radius={[4, 4, 0, 0]}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="aktivitas" 
              stroke="hsl(var(--chart-2))" 
              name="Total Aktivitas"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
