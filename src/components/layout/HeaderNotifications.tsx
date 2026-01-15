import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, X, AtSign, ClipboardList, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface UnifiedNotification {
  id: string;
  type: 'task' | 'mention' | 'candidate';
  title: string;
  message: string;
  createdAt: string;
  createdBy: string | null;
  icon: string;
  taskId?: string;
  candidateId?: string;
  originalData: any;
}

interface HeaderNotificationsProps {
  onTaskClick?: (taskId: string) => void;
  onCandidateClick?: (candidateId: string) => void;
}

export function HeaderNotifications({ onTaskClick, onCandidateClick }: HeaderNotificationsProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      return session.session?.user?.id || null;
    },
  });

  // Fetch task notifications
  const { data: taskNotifications = [] } = useQuery({
    queryKey: ["header-task-notifications", currentUser],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from("task_notifications")
        .select(`
          *,
          tasks(id, title),
          shooting_schedules(title),
          meetings(title),
          created_by_profile:profiles!task_notifications_created_by_fkey(full_name)
        `)
        .eq("user_id", currentUser)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
    refetchInterval: 30000,
  });

  // Fetch mentions
  const { data: mentions = [] } = useQuery({
    queryKey: ["header-mentions", currentUser],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from("comment_mentions")
        .select(`
          *,
          comments!inner(
            content,
            author_id,
            profiles:profiles!fk_comments_author_profiles(full_name)
          ),
          tasks(id, title)
        `)
        .eq("mentioned_user_id", currentUser)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
    refetchInterval: 30000,
  });

  // Fetch candidate notifications (for HR/super_admin)
  const { data: candidateNotifications = [] } = useQuery({
    queryKey: ["header-candidate-notifications", currentUser],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data, error } = await supabase
        .from("candidate_notifications")
        .select(`
          *,
          candidates(id, full_name, position)
        `)
        .eq("user_id", currentUser)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser,
    refetchInterval: 30000,
  });

  // Combine and transform notifications
  const unifiedNotifications: UnifiedNotification[] = [
    ...taskNotifications.map((n: any) => ({
      id: n.id,
      type: 'task' as const,
      title: n.tasks?.title || n.shooting_schedules?.title || n.meetings?.title || 'Notification',
      message: n.message,
      createdAt: n.created_at,
      createdBy: n.created_by_profile?.full_name || null,
      icon: getNotificationIcon(n.notification_type),
      taskId: n.task_id,
      originalData: n,
    })),
    ...mentions.map((m: any) => ({
      id: m.id,
      type: 'mention' as const,
      title: m.tasks?.title || 'Task',
      message: `${m.comments?.profiles?.full_name || 'Someone'} mentioned you: "${m.comments?.content?.substring(0, 50)}${m.comments?.content?.length > 50 ? '...' : ''}"`,
      createdAt: m.created_at,
      createdBy: m.comments?.profiles?.full_name || null,
      icon: '💬',
      taskId: m.task_id,
      originalData: m,
    })),
    ...candidateNotifications.map((c: any) => ({
      id: c.id,
      type: 'candidate' as const,
      title: c.candidates?.full_name || 'Kandidat Baru',
      message: c.message,
      createdAt: c.created_at,
      createdBy: null,
      icon: '👤',
      candidateId: c.candidate_id,
      originalData: c,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalUnread = unifiedNotifications.length;
  const taskCount = taskNotifications.length;
  const mentionCount = mentions.length;
  const candidateCount = candidateNotifications.length;


  const markTaskNotificationAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("task_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      queryClient.invalidateQueries({ queryKey: ["header-task-notifications"] });
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markMentionAsRead = async (mentionId: string) => {
    try {
      await supabase
        .from("comment_mentions")
        .update({ is_read: true })
        .eq("id", mentionId);
      queryClient.invalidateQueries({ queryKey: ["header-mentions"] });
    } catch (error) {
      console.error("Failed to mark mention as read", error);
    }
  };

  const markCandidateNotificationAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("candidate_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      queryClient.invalidateQueries({ queryKey: ["header-candidate-notifications"] });
    } catch (error) {
      console.error("Failed to mark candidate notification as read", error);
    }
  };

  const handleMarkAsRead = async (notification: UnifiedNotification) => {
    if (notification.type === 'task') {
      await markTaskNotificationAsRead(notification.id);
    } else if (notification.type === 'mention') {
      await markMentionAsRead(notification.id);
    } else if (notification.type === 'candidate') {
      await markCandidateNotificationAsRead(notification.id);
    }
  };

  const handleNotificationClick = async (notification: UnifiedNotification) => {
    await handleMarkAsRead(notification);
    if (notification.type === 'candidate' && notification.candidateId) {
      navigate('/recruitment');
      setOpen(false);
    } else if (notification.taskId && onTaskClick) {
      onTaskClick(notification.taskId);
      setOpen(false);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;
    try {
      // Mark all task notifications as read
      await supabase
        .from("task_notifications")
        .update({ is_read: true })
        .eq("user_id", currentUser)
        .eq("is_read", false);
      
      // Mark all mentions as read
      await supabase
        .from("comment_mentions")
        .update({ is_read: true })
        .eq("mentioned_user_id", currentUser)
        .eq("is_read", false);

      // Mark all candidate notifications as read
      await supabase
        .from("candidate_notifications")
        .update({ is_read: true })
        .eq("user_id", currentUser)
        .eq("is_read", false);

      queryClient.invalidateQueries({ queryKey: ["header-task-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["header-mentions"] });
      queryClient.invalidateQueries({ queryKey: ["header-candidate-notifications"] });
      toast.success("Semua notifikasi telah ditandai dibaca");
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };


  const renderNotificationList = (notifications: UnifiedNotification[]) => (
    <div className="divide-y">
      {notifications.length > 0 ? (
        notifications.map((notification) => (
          <div
            key={`${notification.type}-${notification.id}`}
            className="p-3 hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">{notification.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{notification.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(notification.createdAt), "dd MMM yyyy HH:mm")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAsRead(notification);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      ) : (
        <div className="p-8 text-center text-muted-foreground">
          Tidak ada notifikasi baru
        </div>
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {totalUnread > 9 ? '9+' : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifikasi</h4>
          {totalUnread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
              <Check className="h-4 w-4 mr-1" />
              Tandai semua dibaca
            </Button>
          )}
        </div>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="all" className="text-xs">
              Semua {totalUnread > 0 && `(${totalUnread})`}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs">
              <ClipboardList className="h-3 w-3 mr-1" />
              {taskCount > 0 && `(${taskCount})`}
            </TabsTrigger>
            <TabsTrigger value="mentions" className="text-xs">
              <AtSign className="h-3 w-3 mr-1" />
              {mentionCount > 0 && `(${mentionCount})`}
            </TabsTrigger>
            <TabsTrigger value="candidates" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {candidateCount > 0 && `(${candidateCount})`}
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[350px]">
            <TabsContent value="all" className="m-0">
              {renderNotificationList(unifiedNotifications)}
            </TabsContent>
            <TabsContent value="tasks" className="m-0">
              {renderNotificationList(unifiedNotifications.filter(n => n.type === 'task'))}
            </TabsContent>
            <TabsContent value="mentions" className="m-0">
              {renderNotificationList(unifiedNotifications.filter(n => n.type === 'mention'))}
            </TabsContent>
            <TabsContent value="candidates" className="m-0">
              {renderNotificationList(unifiedNotifications.filter(n => n.type === 'candidate'))}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'assigned':
      return '📋';
    case 'updated':
      return '✏️';
    case 'status_changed':
      return '🔄';
    case 'comment':
      return '💬';
    case 'created':
      return '🆕';
    default:
      return '📌';
  }
}
