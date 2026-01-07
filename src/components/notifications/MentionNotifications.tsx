import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AtSign, Check, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface MentionNotificationsProps {
  onTaskClick?: (taskId: string) => void;
}

export function MentionNotifications({ onTaskClick }: MentionNotificationsProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: mentions = [] } = useQuery({
    queryKey: ["my-mentions"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];

      const { data, error } = await supabase
        .from("comment_mentions")
        .select(`
          *,
          comments!inner(
            content,
            author_id,
            profiles:profiles!fk_comments_author_profiles(full_name)
          ),
          tasks!inner(id, title)
        `)
        .eq("mentioned_user_id", session.session.user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching mentions:", error);
        return [];
      }

      return data as any[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleMarkAsRead = async (mentionId: string) => {
    const { error } = await supabase
      .from("comment_mentions")
      .update({ is_read: true })
      .eq("id", mentionId);

    if (error) {
      toast.error("Failed to mark as read");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["my-mentions"] });
  };

  const handleMarkAllAsRead = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { error } = await supabase
      .from("comment_mentions")
      .update({ is_read: true })
      .eq("mentioned_user_id", session.session.user.id)
      .eq("is_read", false);

    if (error) {
      toast.error("Failed to mark all as read");
      return;
    }

    toast.success("All mentions marked as read");
    queryClient.invalidateQueries({ queryKey: ["my-mentions"] });
  };

  const handleClick = (mention: any) => {
    if (mention.task_id && onTaskClick) {
      onTaskClick(mention.task_id);
    }
    handleMarkAsRead(mention.id);
    setOpen(false);
  };

  if (mentions.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <AtSign className="h-4 w-4 mr-1" />
          Mentions
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {mentions.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Mentions</h4>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleMarkAllAsRead}
            className="text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-72">
          {mentions.map((mention) => (
            <div
              key={mention.id}
              className="p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleClick(mention)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {mention.tasks?.title || "Task"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    By {mention.comments?.profiles?.full_name || "Someone"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    "{mention.comments?.content}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(mention.created_at), "PPp")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(mention.id);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
