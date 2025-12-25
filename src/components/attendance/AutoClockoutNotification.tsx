import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock, X } from "lucide-react";

export function AutoClockoutNotification() {
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["auto-clockout-notifications"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const { data, error } = await supabase
        .from("auto_clockout_notifications")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const dismissNotification = async (id: string) => {
    await supabase
      .from("auto_clockout_notifications")
      .update({ is_read: true })
      .eq("id", id);
    
    queryClient.invalidateQueries({ queryKey: ["auto-clockout-notifications"] });
  };

  const dismissAll = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    await supabase
      .from("auto_clockout_notifications")
      .update({ is_read: true })
      .eq("user_id", session.session.user.id)
      .eq("is_read", false);
    
    queryClient.invalidateQueries({ queryKey: ["auto-clockout-notifications"] });
  };

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((notif) => (
        <Alert key={notif.id} className="bg-amber-500/10 border-amber-500/20">
          <Clock className="h-4 w-4 text-amber-500" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{notif.message}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => dismissNotification(notif.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      ))}
      {notifications.length > 1 && (
        <Button variant="outline" size="sm" onClick={dismissAll} className="w-full">
          Dismiss All
        </Button>
      )}
    </div>
  );
}
