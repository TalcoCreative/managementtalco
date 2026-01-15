import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface HRActivityDistributionChartProps {
  taskCount: number;
  meetingCount: number;
  shootingCount: number;
  eventCount: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];

export function HRActivityDistributionChart({ 
  taskCount, 
  meetingCount, 
  shootingCount, 
  eventCount 
}: HRActivityDistributionChartProps) {
  const data = [
    { name: 'Task', value: taskCount },
    { name: 'Meeting', value: meetingCount },
    { name: 'Shooting', value: shootingCount },
    { name: 'Event', value: eventCount },
  ].filter(item => item.value > 0);

  const total = taskCount + meetingCount + shootingCount + eventCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribusi Aktivitas</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Tidak ada aktivitas dalam periode ini
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value} aktivitas`, '']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
