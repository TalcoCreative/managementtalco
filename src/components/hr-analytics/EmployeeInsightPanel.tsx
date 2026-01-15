import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CheckCircle, TrendingUp } from "lucide-react";

interface EmployeeInsightPanelProps {
  attendance: any[];
  tasks: any[];
  employeeId: string;
  attendanceKpis: { autoClockoutDays: number; totalHours: number; daysPresent: number };
  activityKpis: { tasksOverdue: number; totalActivities: number };
}

export function EmployeeInsightPanel({ attendanceKpis, activityKpis }: EmployeeInsightPanelProps) {
  const insights: { icon: any; title: string; description: string; type: 'warning' | 'info' | 'success' }[] = [];

  if (attendanceKpis.autoClockoutDays >= 3) {
    insights.push({ icon: Clock, title: 'Sering Lupa Clock-out', description: `${attendanceKpis.autoClockoutDays} hari auto clock-out dalam periode ini`, type: 'warning' });
  }
  if (activityKpis.tasksOverdue >= 3) {
    insights.push({ icon: AlertTriangle, title: 'Task Overdue Tinggi', description: `${activityKpis.tasksOverdue} task belum selesai melewati deadline`, type: 'warning' });
  }
  if (attendanceKpis.totalHours > 0 && activityKpis.totalActivities === 0) {
    insights.push({ icon: Clock, title: 'Jam Kerja Tanpa Aktivitas', description: 'Ada jam kerja tercatat tapi tidak ada aktivitas yang diselesaikan', type: 'info' });
  }
  if (attendanceKpis.autoClockoutDays === 0 && activityKpis.tasksOverdue === 0) {
    insights.push({ icon: CheckCircle, title: 'Konsistensi Baik', description: 'Tidak ada masalah kehadiran atau overdue', type: 'success' });
  }
  if (activityKpis.totalActivities > 15) {
    insights.push({ icon: TrendingUp, title: 'Produktivitas Tinggi', description: `${activityKpis.totalActivities} aktivitas selesai dalam periode ini`, type: 'success' });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Discipline & Consistency Insight</CardTitle></CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Tidak ada insight khusus</p>
        ) : (
          <div className="space-y-4">
            {insights.map((insight, i) => (
              <div key={i} className={`p-4 rounded-lg border ${insight.type === 'warning' ? 'border-amber-500/50 bg-amber-500/10' : insight.type === 'success' ? 'border-green-500/50 bg-green-500/10' : 'border-blue-500/50 bg-blue-500/10'}`}>
                <div className="flex items-center gap-2">
                  <insight.icon className={`h-5 w-5 ${insight.type === 'warning' ? 'text-amber-500' : insight.type === 'success' ? 'text-green-500' : 'text-blue-500'}`} />
                  <h4 className="font-medium">{insight.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
