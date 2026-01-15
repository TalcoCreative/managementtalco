import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, eachDayOfInterval } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMemo } from "react";

interface HRAutoClockoutChartProps {
  attendance: any[];
  startDate: string;
  endDate: string;
}

export function HRAutoClockoutChart({ attendance, startDate, endDate }: HRAutoClockoutChartProps) {
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({
      start: new Date(startDate),
      end: new Date(endDate)
    });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'dd MMM', { locale: idLocale });

      const autoClockoutCount = attendance.filter(a => 
        a.date === dateStr && a.notes?.includes('[AUTO CLOCK-OUT')
      ).length;

      return {
        date: dayLabel,
        autoClockout: autoClockoutCount,
      };
    }).filter(d => d.autoClockout > 0);
  }, [attendance, startDate, endDate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Trend Auto Clock-out
          <span className="text-sm font-normal text-muted-foreground">
            (Lupa Clock-out)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <div className="text-center">
              <p>🎉 Tidak ada auto clock-out</p>
              <p className="text-sm mt-1">Semua karyawan clock-out dengan baik!</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value} karyawan`, 'Auto Clock-out']}
              />
              <Bar 
                dataKey="autoClockout" 
                fill="hsl(var(--chart-4))" 
                name="Auto Clock-out"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
