import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Eye } from "lucide-react";
import { format } from "date-fns";

export function DeletionNotifications() {
  const queryClient = useQueryClient();

  const { data: deletionLogs } = useQuery({
    queryKey: ["deletion-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_logs")
        .select("*, profiles:profiles!deletion_logs_deleted_by_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
  });

  const unviewedCount = deletionLogs?.filter(log => !log.viewed_at).length || 0;

  const handleMarkViewed = async (logId: string) => {
    await supabase
      .from("deletion_logs")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", logId);
    
    queryClient.invalidateQueries({ queryKey: ["deletion-logs"] });
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      client: "Client",
      task: "Task",
      project: "Project",
      shooting: "Shooting Schedule",
    };
    return labels[type] || type;
  };

  const getEntityTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      client: "bg-blue-500",
      task: "bg-green-500",
      project: "bg-purple-500",
      shooting: "bg-orange-500",
    };
    return colors[type] || "bg-muted";
  };

  if (!deletionLogs || deletionLogs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Deletion Logs
            {unviewedCount > 0 && (
              <Badge variant="destructive">{unviewedCount} new</Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {deletionLogs.map((log) => (
          <div
            key={log.id}
            className={`rounded-lg border p-4 space-y-2 ${
              !log.viewed_at ? "bg-destructive/5 border-destructive/20" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge className={getEntityTypeColor(log.entity_type)}>
                  {getEntityTypeLabel(log.entity_type)}
                </Badge>
                <span className="font-medium">{log.entity_name}</span>
              </div>
              {!log.viewed_at && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkViewed(log.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Alasan:</strong> {log.reason}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Dihapus oleh: {log.profiles?.full_name || "Unknown"}</span>
              <span>•</span>
              <span>{format(new Date(log.created_at), "PPp")}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
