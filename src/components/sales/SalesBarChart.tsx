import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { differenceInDays, parseISO } from "date-fns";

interface SalesBarChartProps {
  title: string;
  prospects: any[];
  activityLogs: any[];
  statusHistory: any[];
  type?: "time_per_status" | "sales_performance";
  salesUsers?: any[];
}

const STATUS_COLORS = {
  new: "#3b82f6",
  contacted: "#eab308",
  meeting: "#a855f7",
  proposal: "#f97316",
  negotiation: "#6366f1",
};

const STATUS_ORDER = ["new", "contacted", "meeting", "proposal", "negotiation"];

export function SalesBarChart({ 
  title, 
  prospects, 
  activityLogs, 
  statusHistory, 
  type = "time_per_status",
  salesUsers = []
}: SalesBarChartProps) {
  const [metric, setMetric] = useState<"prospects" | "won" | "closingRate">("prospects");

  const timePerStatusData = useMemo(() => {
    if (type !== "time_per_status") return [];

    const statusDurations: Record<string, number[]> = {};
    STATUS_ORDER.forEach(s => statusDurations[s] = []);

    prospects.forEach(prospect => {
      const history = statusHistory
        .filter(h => h.prospect_id === prospect.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Calculate time spent in each status
      let currentStatus = "new";
      let currentStatusStart = parseISO(prospect.created_at);

      history.forEach(entry => {
        const entryDate = parseISO(entry.created_at);
        const daysInStatus = differenceInDays(entryDate, currentStatusStart);
        
        if (STATUS_ORDER.includes(currentStatus) && daysInStatus >= 0) {
          statusDurations[currentStatus].push(daysInStatus);
        }
        
        currentStatus = entry.new_status;
        currentStatusStart = entryDate;
      });

      // Add time in current status
      if (STATUS_ORDER.includes(prospect.status)) {
        const daysInCurrent = differenceInDays(new Date(), parseISO(prospect.updated_at));
        if (daysInCurrent >= 0) {
          statusDurations[prospect.status].push(daysInCurrent);
        }
      }
    });

    return STATUS_ORDER.map(status => {
      const durations = statusDurations[status];
      const avgDays = durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

      return {
        status,
        label: status.charAt(0).toUpperCase() + status.slice(1),
        avgDays,
        color: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
      };
    });
  }, [prospects, statusHistory, type]);

  const salesPerformanceData = useMemo(() => {
    if (type !== "sales_performance") return [];

    const salesStats: Record<string, { name: string; prospects: number; won: number; lost: number }> = {};

    // Initialize with known sales users
    salesUsers.forEach(user => {
      salesStats[user.user_id] = {
        name: user.profile?.full_name || "Unknown",
        prospects: 0,
        won: 0,
        lost: 0,
      };
    });

    prospects.forEach(p => {
      const picId = p.pic_id;
      if (!picId) return;

      if (!salesStats[picId]) {
        salesStats[picId] = {
          name: p.pic?.full_name || "Unknown",
          prospects: 0,
          won: 0,
          lost: 0,
        };
      }

      salesStats[picId].prospects++;
      if (p.status === "won") salesStats[picId].won++;
      if (p.status === "lost") salesStats[picId].lost++;
    });

    return Object.entries(salesStats)
      .map(([id, stats]) => ({
        id,
        name: stats.name,
        prospects: stats.prospects,
        won: stats.won,
        closingRate: stats.won + stats.lost > 0 
          ? Math.round((stats.won / (stats.won + stats.lost)) * 100) 
          : 0,
      }))
      .filter(s => s.prospects > 0)
      .sort((a, b) => b[metric] - a[metric]);
  }, [prospects, salesUsers, type, metric]);

  const chartData = type === "time_per_status" ? timePerStatusData : salesPerformanceData;
  const dataKey = type === "time_per_status" ? "avgDays" : metric;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {type === "sales_performance" && (
          <Select value={metric} onValueChange={(v) => setMetric(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prospects">Total Prospects</SelectItem>
              <SelectItem value="won">Deals Won</SelectItem>
              <SelectItem value="closingRate">Closing Rate</SelectItem>
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
              <XAxis 
                type="number"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => type === "time_per_status" ? `${v}d` : metric === "closingRate" ? `${v}%` : v}
              />
              <YAxis 
                dataKey={type === "time_per_status" ? "label" : "name"}
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
                formatter={(value: number) => [
                  type === "time_per_status" 
                    ? `${value} days` 
                    : metric === "closingRate" 
                      ? `${value}%` 
                      : value,
                  type === "time_per_status" ? 'Avg Duration' : metric === "closingRate" ? 'Closing Rate' : metric === "won" ? 'Deals Won' : 'Total Prospects'
                ]}
              />
              <Bar 
                dataKey={dataKey as string}
                radius={[0, 4, 4, 0]}
                fill="hsl(220, 70%, 50%)"
              >
                {type === "time_per_status" && chartData.map((entry: any, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
