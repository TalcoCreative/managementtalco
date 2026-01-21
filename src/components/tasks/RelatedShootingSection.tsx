import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Camera, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface RelatedShootingSectionProps {
  taskId: string;
  onShootingClick?: (shootingId: string) => void;
}

export function RelatedShootingSection({ taskId, onShootingClick }: RelatedShootingSectionProps) {
  // Fetch related shootings for this task
  const { data: relatedShootings } = useQuery({
    queryKey: ["task-related-shootings", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_tasks")
        .select(`
          id,
          shooting_id,
          shooting_schedules:shooting_id (
            id,
            title,
            status,
            scheduled_date,
            scheduled_time,
            location,
            clients(name),
            projects(title)
          )
        `)
        .eq("task_id", taskId);
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500";
      case "rejected": return "bg-red-500";
      case "cancelled": return "bg-gray-500";
      case "completed": return "bg-blue-500";
      default: return "bg-yellow-500";
    }
  };

  if (!relatedShootings || relatedShootings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">Related Shooting</span>
        <Badge variant="secondary">{relatedShootings.length}</Badge>
      </div>
      <div className="space-y-2">
        {relatedShootings.map((relation) => {
          const shooting = relation.shooting_schedules as any;
          if (!shooting) return null;

          return (
            <div
              key={relation.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer group"
              onClick={() => onShootingClick?.(shooting.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{shooting.title}</p>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={getStatusColor(shooting.status)} variant="secondary">
                    {shooting.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(shooting.scheduled_date), "dd MMM yyyy")}
                    {shooting.scheduled_time && ` • ${shooting.scheduled_time}`}
                  </span>
                  {shooting.clients?.name && (
                    <span className="text-xs text-muted-foreground">
                      • {shooting.clients.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
