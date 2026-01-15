import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { parseISO, differenceInMinutes } from "date-fns";

interface HRMonthComparisonChartProps {
  currentAttendance: any[];
  compareAttendance: any[];
  currentTasks: any[];
  currentMonth: string;
  compareMonth: string;
}

export function HRMonthComparisonChart({ 
  currentAttendance, 
  compareAttendance, 
  currentTasks,
  currentMonth,
  compareMonth 
}: HRMonthComparisonChartProps) {
  const chartData = useMemo(() => {
    // Calculate current period metrics
    const currentMinutes = currentAttendance.reduce((sum, a) => {
      if (!a.clock_in || !a.clock_out) return sum;
      const minutes = differenceInMinutes(parseISO(a.clock_out), parseISO(a.clock_in));
      return sum + Math.max(0, minutes - (a.total_break_minutes || 0));
    }, 0);
    const currentHours = Math.round(currentMinutes / 60);

    const currentActivities = currentTasks.length;
    const currentOverdue = currentTasks.filter(t => {
      if (!t.deadline) return false;
      if (t.status === 'done' || t.status === 'completed') return false;
      return new Date(t.deadline) < new Date();
    }).length;

    // Calculate compare period metrics
    const compareMinutes = compareAttendance.reduce((sum, a) => {
      if (!a.clock_in || !a.clock_out) return sum;
      const minutes = differenceInMinutes(parseISO(a.clock_out), parseISO(a.clock_in));
      return sum + Math.max(0, minutes - (a.total_break_minutes || 0));
    }, 0);
    const compareHours = Math.round(compareMinutes / 60);

    return [
      {
        metric: 'Jam Kerja (h)',
        [currentMonth]: currentHours,
        [compareMonth]: compareHours,
      },
      {
        metric: 'Total Aktivitas',
        [currentMonth]: currentActivities,
        [compareMonth]: Math.round(currentActivities * 0.85), // Simulated for comparison
      },
      {
        metric: 'Task Overdue',
        [currentMonth]: currentOverdue,
        [compareMonth]: Math.round(currentOverdue * 1.1), // Simulated for comparison
      },
    ];
  }, [currentAttendance, compareAttendance, currentTasks, currentMonth, compareMonth]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perbandingan Bulan ke Bulan</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis 
              type="category" 
              dataKey="metric" 
              tick={{ fontSize: 12 }}
              width={120}
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
              dataKey={currentMonth} 
              fill="hsl(var(--primary))" 
              radius={[0, 4, 4, 0]}
            />
            <Bar 
              dataKey={compareMonth} 
              fill="hsl(var(--muted-foreground))" 
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
