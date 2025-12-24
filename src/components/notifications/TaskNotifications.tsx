import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";

export function TaskNotifications() {
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      return session.session?.user?.id || null;
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ["task-notifications", currentUser],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from("task_notifications")
        .select(`
          *,
          tasks(title),
          shooting_schedules(title),
          meetings(title),
          created_by_profile:profiles!task_notifications_created_by_fkey(full_name)
        `)
        .eq("user_id", currentUser)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentUser,
  });

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("task_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      queryClient.invalidateQueries({ queryKey: ["task-notifications"] });
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;
    try {
      await supabase
        .from("task_notifications")
        .update({ is_read: true })
        .eq("user_id", currentUser)
        .eq("is_read", false);
      queryClient.invalidateQueries({ queryKey: ["task-notifications"] });
      toast.success("Semua notifikasi telah ditandai dibaca");
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const unreadCount = notifications?.length || 0;

  const getNotificationTitle = (notification: any) => {
    if (notification.tasks) return notification.tasks.title;
    if (notification.shooting_schedules) return notification.shooting_schedules.title;
    if (notification.meetings) return notification.meetings.title;
    return "Unknown";
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assigned':
        return '📋';
      case 'updated':
        return '✏️';
      case 'status_changed':
        return '🔄';
      case 'comment':
        return '💬';
      default:
        return '📌';
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifikasi</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <Check className="h-4 w-4 mr-1" />
              Tandai semua dibaca
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">
                      {getNotificationIcon(notification.notification_type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getNotificationTitle(notification)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notification.created_at), "dd MMM yyyy HH:mm")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Tidak ada notifikasi baru
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
