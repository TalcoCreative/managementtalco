import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

interface SalesFunnelChartProps {
  prospects: any[];
  statusOptions: StatusOption[];
}

const FUNNEL_ORDER = ["new", "contacted", "meeting", "proposal", "negotiation", "won"];
const FUNNEL_COLORS = {
  new: "#3b82f6",
  contacted: "#eab308",
  meeting: "#a855f7",
  proposal: "#f97316",
  negotiation: "#6366f1",
  won: "#22c55e",
};

export function SalesFunnelChart({ prospects, statusOptions }: SalesFunnelChartProps) {
  const chartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    
    FUNNEL_ORDER.forEach(status => {
      statusCounts[status] = 0;
    });

    prospects.forEach(p => {
      if (FUNNEL_ORDER.includes(p.status)) {
        statusCounts[p.status]++;
      }
    });

    const total = prospects.length || 1;
    
    return FUNNEL_ORDER.map((status, index) => {
      const count = statusCounts[status];
      const percentage = (count / total) * 100;
      const label = statusOptions.find(s => s.value === status)?.label || status;
      
      // Calculate conversion from previous stage
      const prevCount = index > 0 ? statusCounts[FUNNEL_ORDER[index - 1]] : total;
      const conversionRate = prevCount > 0 ? (count / prevCount) * 100 : 0;

      return {
        status,
        label,
        count,
        percentage: Math.round(percentage * 10) / 10,
        conversionRate: Math.round(conversionRate * 10) / 10,
        color: FUNNEL_COLORS[status as keyof typeof FUNNEL_COLORS],
      };
    });
  }, [prospects, statusOptions]);

  const totalProspects = prospects.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Funnel Conversion</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ left: 20, right: 40 }}
            >
              <XAxis 
                type="number"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                dataKey="label" 
                type="category"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={100}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string, props: any) => [
                  `${value} (${props.payload.percentage}%)`,
                  'Count'
                ]}
              />
              <Bar 
                dataKey="count" 
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Conversion rates */}
        <div className="mt-4 grid grid-cols-5 gap-2 text-center">
          {chartData.slice(1).map((item, index) => (
            <div key={item.status} className="text-xs">
              <div className="text-muted-foreground">→</div>
              <div className="font-medium">{item.conversionRate}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
