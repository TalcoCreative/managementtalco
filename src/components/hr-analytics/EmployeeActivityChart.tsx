import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface EmployeeActivityChartProps {
  tasks: any[];
  meetings: any[];
  shootings: any[];
  events: any[];
  employeeId: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export function EmployeeActivityChart({ tasks, meetings, shootings, events }: EmployeeActivityChartProps) {
  const data = [
    { name: 'Task', value: tasks.length },
    { name: 'Meeting', value: meetings.length },
    { name: 'Shooting', value: shootings.length },
    { name: 'Event', value: events.length },
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardHeader><CardTitle>Distribusi Aktivitas</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">Tidak ada aktivitas</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
