import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";

interface SourceOption {
  value: string;
  label: string;
}

interface SalesSourceChartProps {
  prospects: any[];
  sourceOptions: SourceOption[];
}

const SOURCE_COLORS = [
  "#3b82f6",
  "#22c55e", 
  "#f97316",
  "#a855f7",
  "#eab308",
  "#6366f1",
];

export function SalesSourceChart({ prospects, sourceOptions }: SalesSourceChartProps) {
  const chartData = useMemo(() => {
    const sourceStats: Record<string, { total: number; won: number; lost: number }> = {};

    sourceOptions.forEach(source => {
      sourceStats[source.value] = { total: 0, won: 0, lost: 0 };
    });

    prospects.forEach(p => {
      const source = p.source;
      if (!sourceStats[source]) {
        sourceStats[source] = { total: 0, won: 0, lost: 0 };
      }
      sourceStats[source].total++;
      if (p.status === "won") sourceStats[source].won++;
      if (p.status === "lost") sourceStats[source].lost++;
    });

    return sourceOptions.map((source, index) => {
      const stats = sourceStats[source.value];
      const closingRate = stats.won + stats.lost > 0 
        ? Math.round((stats.won / (stats.won + stats.lost)) * 100) 
        : 0;

      return {
        source: source.value,
        label: source.label,
        total: stats.total,
        won: stats.won,
        closingRate,
        color: SOURCE_COLORS[index % SOURCE_COLORS.length],
      };
    }).filter(s => s.total > 0);
  }, [prospects, sourceOptions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Lead Source Effectiveness</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 20, right: 20 }}>
              <XAxis 
                dataKey="label" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis 
                yAxisId="left"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="total" 
                name="Total Leads"
                fill="hsl(220, 70%, 50%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                yAxisId="left"
                dataKey="won" 
                name="Won"
                fill="hsl(150, 50%, 45%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Closing rate by source */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          {chartData.slice(0, 6).map(item => (
            <div key={item.source} className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="text-lg font-semibold">{item.closingRate}%</div>
              <div className="text-xs text-muted-foreground">closing rate</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
