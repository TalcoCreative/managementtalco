import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface SalesBottleneckCardProps {
  prospects: any[];
  activityLogs: any[];
  statusHistory: any[];
}

const THRESHOLDS = {
  contacted: 3,
  meeting: 5,
  proposal: 7,
  negotiation: 14,
};

const STATUS_LABELS = {
  contacted: "Contacted",
  meeting: "Meeting",
  proposal: "Proposal",
  negotiation: "Negotiation",
};

export function SalesBottleneckCard({ prospects, activityLogs, statusHistory }: SalesBottleneckCardProps) {
  const bottlenecks = useMemo(() => {
    const result: Record<string, { total: number; overThreshold: number; avgDays: number; prospects: any[] }> = {};

    Object.keys(THRESHOLDS).forEach(status => {
      result[status] = { total: 0, overThreshold: 0, avgDays: 0, prospects: [] };
    });

    // Find prospects currently in each status and their duration
    prospects.forEach(prospect => {
      const status = prospect.status;
      if (!THRESHOLDS[status as keyof typeof THRESHOLDS]) return;

      // Find when they entered this status
      const history = statusHistory
        .filter(h => h.prospect_id === prospect.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const statusEntry = history.find(h => h.new_status === status);
      const enteredAt = statusEntry ? parseISO(statusEntry.created_at) : parseISO(prospect.created_at);
      const daysInStatus = differenceInDays(new Date(), enteredAt);

      result[status].total++;
      result[status].avgDays = (result[status].avgDays * (result[status].total - 1) + daysInStatus) / result[status].total;

      if (daysInStatus > THRESHOLDS[status as keyof typeof THRESHOLDS]) {
        result[status].overThreshold++;
        result[status].prospects.push({
          ...prospect,
          daysInStatus,
        });
      }
    });

    return Object.entries(result).map(([status, data]) => ({
      status,
      label: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
      threshold: THRESHOLDS[status as keyof typeof THRESHOLDS],
      ...data,
      avgDays: Math.round(data.avgDays),
      isBottleneck: data.overThreshold > 0,
    }));
  }, [prospects, statusHistory]);

  const totalBottlenecks = bottlenecks.reduce((acc, b) => acc + b.overThreshold, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Bottleneck Detection
          </CardTitle>
          {totalBottlenecks > 0 && (
            <Badge variant="destructive">
              {totalBottlenecks} prospects need attention
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {bottlenecks.map(item => (
            <div
              key={item.status}
              className={cn(
                "p-4 rounded-lg border-2 transition-colors",
                item.isBottleneck 
                  ? "border-destructive/50 bg-destructive/5" 
                  : "border-border bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{item.label}</span>
                {item.isBottleneck ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Threshold:</span>
                  <span className="font-medium">&gt; {item.threshold} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Duration:</span>
                  <span className={cn(
                    "font-medium",
                    item.avgDays > item.threshold && "text-destructive"
                  )}>
                    {item.avgDays} days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Over Threshold:</span>
                  <span className={cn(
                    "font-medium",
                    item.overThreshold > 0 && "text-destructive"
                  )}>
                    {item.overThreshold} / {item.total}
                  </span>
                </div>
              </div>

              {item.isBottleneck && item.prospects.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Stuck prospects:</p>
                  <div className="space-y-1">
                    {item.prospects.slice(0, 3).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[120px]">{p.contact_name}</span>
                        <Badge variant="outline" className="text-destructive">
                          {p.daysInStatus}d
                        </Badge>
                      </div>
                    ))}
                    {item.prospects.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{item.prospects.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
