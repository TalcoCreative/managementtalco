import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface EventHistoryTabProps {
  eventId: string;
}

const actionLabels: Record<string, string> = {
  created: "Event dibuat",
  updated: "Event diperbarui",
  status_changed: "Status diubah",
  phase_changed: "Phase diubah",
};

export function EventHistoryTab({ eventId }: EventHistoryTabProps) {
  const { data: history } = useQuery({
    queryKey: ["event-history", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_history")
        .select(`
          *,
          changer:profiles(full_name)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5" />
        <h3 className="font-medium">Riwayat Perubahan</h3>
        <Badge variant="outline">{history?.length || 0} log</Badge>
      </div>

      <div className="space-y-3">
        {history?.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            Belum ada riwayat perubahan
          </p>
        ) : (
          history?.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 rounded-lg border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {actionLabels[log.action] || log.action}
                  </span>
                  {log.old_value && log.new_value && (
                    <span className="text-sm text-muted-foreground">
                      {log.old_value} → {log.new_value}
                    </span>
                  )}
                  {!log.old_value && log.new_value && (
                    <span className="text-sm text-muted-foreground">
                      {log.new_value}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  oleh {log.changer?.full_name || "Unknown"} pada{" "}
                  {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: localeId })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
