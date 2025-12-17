import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

interface MeetingNotificationsProps {
  onMeetingClick: (meeting: any) => void;
}

const MeetingNotifications = ({ onMeetingClick }: MeetingNotificationsProps) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch notifications with meeting details
  const { data: notifications } = useQuery({
    queryKey: ["meeting-notifications", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data, error } = await supabase
        .from("meeting_notifications")
        .select(`
          *,
          meeting:meetings(
            *,
            creator:profiles!fk_meetings_created_by(id, full_name)
          )
        `)
        .eq("user_id", currentUser.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const unreadCount = notifications?.length || 0;

  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    await supabase
      .from("meeting_notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    queryClient.invalidateQueries({ queryKey: ["meeting-notifications"] });
    setOpen(false);
    onMeetingClick(notification.meeting);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h4 className="font-semibold">Undangan Meeting</h4>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 
              ? `${unreadCount} undangan baru` 
              : "Tidak ada undangan baru"
            }
          </p>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Tidak ada undangan meeting
            </div>
          ) : (
            <div className="divide-y">
              {notifications?.map((notification) => (
                <div 
                  key={notification.id}
                  className="p-4 hover:bg-muted cursor-pointer"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <p className="font-medium text-sm">{notification.meeting.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(parseISO(notification.meeting.meeting_date), "dd MMM yyyy", { locale: id })}
                    <Clock className="w-3 h-3 ml-2" />
                    {notification.meeting.start_time.slice(0, 5)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dari: {notification.meeting.creator?.full_name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default MeetingNotifications;
