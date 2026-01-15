import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface EmployeeAttendanceChartProps {
  attendance: any[];
  startDate: string;
  endDate: string;
}

export function EmployeeAttendanceChart({ attendance }: EmployeeAttendanceChartProps) {
  const chartData = attendance.slice().reverse().map(a => ({
    date: format(new Date(a.date), 'dd MMM', { locale: idLocale }),
    masuk: a.clock_in ? parseISO(a.clock_in).getHours() + parseISO(a.clock_in).getMinutes() / 60 : null,
    pulang: a.clock_out && !a.notes?.includes('[AUTO CLOCK-OUT') 
      ? parseISO(a.clock_out).getHours() + parseISO(a.clock_out).getMinutes() / 60 
      : null,
  }));

  return (
    <Card>
      <CardHeader><CardTitle>Jam Masuk & Pulang</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[6, 24]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="masuk" stroke="hsl(var(--primary))" name="Masuk" />
            <Line type="monotone" dataKey="pulang" stroke="hsl(var(--chart-2))" name="Pulang" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
