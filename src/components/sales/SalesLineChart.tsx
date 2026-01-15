import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface SalesLineChartProps {
  title: string;
  prospects: any[];
  statusHistory: any[];
  dateRange: { from: Date; to: Date };
  metric: "won" | "closing_rate" | "new_prospects";
}

export function SalesLineChart({ title, prospects, statusHistory, dateRange, metric }: SalesLineChartProps) {
  const chartData = useMemo(() => {
    // Get all months in the range (or last 12 months if range is smaller)
    const months = eachMonthOfInterval({
      start: startOfMonth(dateRange.from),
      end: endOfMonth(dateRange.to),
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      // Prospects created in this month
      const monthProspects = prospects.filter(p => {
        const created = parseISO(p.created_at);
        return created >= monthStart && created <= monthEnd;
      });

      // Status changes to 'won' in this month
      const wonInMonth = statusHistory.filter(h => {
        const changed = parseISO(h.created_at);
        return h.new_status === "won" && changed >= monthStart && changed <= monthEnd;
      });

      // Status changes to 'lost' in this month
      const lostInMonth = statusHistory.filter(h => {
        const changed = parseISO(h.created_at);
        return h.new_status === "lost" && changed >= monthStart && changed <= monthEnd;
      });

      const totalClosed = wonInMonth.length + lostInMonth.length;
      const closingRate = totalClosed > 0 ? (wonInMonth.length / totalClosed) * 100 : 0;

      return {
        month: format(month, "MMM yyyy", { locale: localeId }),
        shortMonth: format(month, "MMM", { locale: localeId }),
        won: wonInMonth.length,
        lost: lostInMonth.length,
        newProspects: monthProspects.length,
        closingRate: Math.round(closingRate * 10) / 10,
      };
    });
  }, [prospects, statusHistory, dateRange]);

  const dataKey = metric === "won" ? "won" : metric === "closing_rate" ? "closingRate" : "newProspects";
  const isPercentage = metric === "closing_rate";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {metric === "closing_rate" ? (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorClosing" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="shortMonth" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
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
                  formatter={(value: number) => [`${value}%`, 'Closing Rate']}
                />
                <Area 
                  type="monotone" 
                  dataKey={dataKey}
                  stroke="hsl(220, 70%, 50%)" 
                  fillOpacity={1} 
                  fill="url(#colorClosing)" 
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="shortMonth" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [value, metric === "won" ? 'Deals Won' : 'New Prospects']}
                />
                <Line 
                  type="monotone" 
                  dataKey={dataKey}
                  stroke="hsl(150, 50%, 45%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(150, 50%, 45%)', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
