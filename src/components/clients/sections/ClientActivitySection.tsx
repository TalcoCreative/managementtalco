import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, FileText, CreditCard, Package, Building2, Upload } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface ClientActivitySectionProps {
  clientId: string;
  client: any;
  canEdit: boolean;
}

const ACTION_ICONS: Record<string, any> = {
  update_overview: Building2,
  contract_upload: FileText,
  payment_paid: CreditCard,
  quota_added: Package,
  quota_used: Package,
  document_upload: Upload,
  default: Activity,
};

const ACTION_LABELS: Record<string, string> = {
  update_overview: "Overview diperbarui",
  contract_upload: "Kontrak diupload",
  payment_paid: "Pembayaran dikonfirmasi",
  quota_added: "Kuota ditambahkan",
  quota_used: "Kuota digunakan",
  document_upload: "Dokumen diupload",
  status_change: "Status berubah",
};

export function ClientActivitySection({ clientId, client, canEdit }: ClientActivitySectionProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["client-activities", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_activity_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      
      // Fetch profile names for changed_by
      const userIds = [...new Set(data.map(a => a.changed_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      
      return data.map(activity => ({
        ...activity,
        changedByName: profileMap.get(activity.changed_by) || "Unknown",
      }));
    },
  });

  const getIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || ACTION_ICONS.default;
    return <Icon className="h-4 w-4" />;
  };

  const getActionLabel = (action: string) => {
    return ACTION_LABELS[action] || action;
  };

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Belum ada aktivitas tercatat</p>
      </div>
    );
  }

  // Group activities by date
  const groupedActivities = activities.reduce((groups: Record<string, typeof activities>, activity) => {
    const date = format(new Date(activity.created_at), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(groupedActivities).map(([date, dayActivities]) => (
        <div key={date}>
          <div className="sticky top-0 bg-background py-2">
            <p className="text-sm font-medium text-muted-foreground">
              {format(new Date(date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
            </p>
          </div>
          <div className="relative ml-3 border-l border-border pl-6 space-y-4">
            {dayActivities.map((activity) => (
              <div key={activity.id} className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    {getIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{getActionLabel(activity.action)}</p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), "HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {activity.description}
                    </p>
                    {activity.changedByName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        oleh {activity.changedByName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
