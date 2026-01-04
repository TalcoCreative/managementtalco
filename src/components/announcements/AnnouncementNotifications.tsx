import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X, AlertTriangle, Info, Bell, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  profiles?: { full_name: string };
}

export function AnnouncementNotifications() {
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      return session.session.user;
    },
  });

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*, profiles(full_name)")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Announcement[];
    },
  });

  const { data: readAnnouncements } = useQuery({
    queryKey: ["announcement-reads"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const { data, error } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", session.session.user.id);

      if (error) throw error;
      return data.map((r) => r.announcement_id);
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("announcements-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["announcements"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleDismiss = async (announcementId: string) => {
    if (!currentUser) return;

    try {
      await supabase.from("announcement_reads").insert({
        announcement_id: announcementId,
        user_id: currentUser.id,
      });

      setDismissedIds((prev) => [...prev, announcementId]);
      queryClient.invalidateQueries({ queryKey: ["announcement-reads"] });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "high":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case "normal":
        return <Bell className="h-5 w-5 text-primary" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-500 hover:bg-orange-600">Tinggi</Badge>;
      case "normal":
        return <Badge variant="secondary">Normal</Badge>;
      default:
        return <Badge variant="outline">Rendah</Badge>;
    }
  };

  const unreadAnnouncements = announcements?.filter(
    (a) =>
      !readAnnouncements?.includes(a.id) && !dismissedIds.includes(a.id)
  );

  if (!unreadAnnouncements || unreadAnnouncements.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-5 w-5 text-primary" />
          Pengumuman ({unreadAnnouncements.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {unreadAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className={`relative rounded-lg border p-4 ${
                  announcement.priority === "urgent"
                    ? "border-destructive/50 bg-destructive/5"
                    : announcement.priority === "high"
                    ? "border-orange-500/50 bg-orange-500/5"
                    : "border-border bg-card"
                }`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() => handleDismiss(announcement.id)}
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="flex items-start gap-3 pr-8">
                  {getPriorityIcon(announcement.priority)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{announcement.title}</h4>
                      {getPriorityBadge(announcement.priority)}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Oleh {announcement.profiles?.full_name || "Admin"} •{" "}
                      {format(new Date(announcement.created_at), "dd MMM yyyy HH:mm", {
                        locale: id,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
