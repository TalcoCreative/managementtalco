import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, User, Plus, Loader2, Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { useEffect } from "react";

export interface ChatConversationListItem {
  id: string;
  type: "dm" | "group";
  name: string | null;
  last_message_at: string;
  display_name: string;
  display_avatar?: string | null;
}

export function ConversationList({
  currentUserId,
  unreadByConv,
  activeId,
  onSelect,
  onNewClick,
}: {
  currentUserId: string;
  unreadByConv: Record<string, number>;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewClick: () => void;
}) {
  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ["chat-conversations", currentUserId],
    queryFn: async () => {
      const { data: parts } = await supabase
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", currentUserId);
      const ids = (parts ?? []).map((p) => p.conversation_id);
      if (ids.length === 0) return [] as ChatConversationListItem[];

      const { data: convs } = await supabase
        .from("chat_conversations")
        .select("id,type,name,last_message_at")
        .in("id", ids)
        .order("last_message_at", { ascending: false });

      // For DMs: load other participant
      const dmIds = (convs ?? []).filter((c) => c.type === "dm").map((c) => c.id);
      const { data: dmParts } = dmIds.length
        ? await supabase
            .from("chat_participants")
            .select("conversation_id,user_id")
            .in("conversation_id", dmIds)
            .neq("user_id", currentUserId)
        : { data: [] as any };
      const dmMap = new Map<string, string>();
      (dmParts ?? []).forEach((p: any) => dmMap.set(p.conversation_id, p.user_id));

      const otherUserIds = Array.from(new Set(Array.from(dmMap.values())));
      const { data: profs } = otherUserIds.length
        ? await supabase.from("profiles").select("id,full_name").in("id", otherUserIds)
        : { data: [] as any };
      const profMap = new Map<string, string>();
      (profs ?? []).forEach((p: any) => profMap.set(p.id, p.full_name ?? "Unknown"));

      return (convs ?? []).map<ChatConversationListItem>((c) => {
        if (c.type === "group") {
          return { ...c, display_name: c.name ?? "Group", display_avatar: null };
        }
        const other = dmMap.get(c.id);
        return { ...c, display_name: other ? (profMap.get(other) ?? "Unknown") : "Direct message", display_avatar: null };
      });
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat-conv-list-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_participants", filter: `user_id=eq.${currentUserId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUserId, refetch]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">Messages</h3>
        <button
          onClick={onNewClick}
          className="h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {/* Tassa AI pinned entry */}
        <button
          onClick={() => onSelect("__tassa_ai__")}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all mb-1 relative overflow-hidden group",
            activeId === "__tassa_ai__"
              ? "bg-gradient-to-r from-violet-500/20 via-fuchsia-500/15 to-indigo-500/20 shadow-[inset_0_0_0_1px_hsl(263_75%_60%/0.4)]"
              : "bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-indigo-500/10 hover:from-violet-500/15 hover:to-indigo-500/15"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/10 to-violet-500/0 opacity-0 group-hover:opacity-100 animate-pulse pointer-events-none" />
          <div className="relative h-9 w-9 rounded-full shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 blur-md opacity-70 animate-pulse" />
            <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/50">
              <Bot className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0 relative">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">Tassa AI</span>
              <Sparkles className="h-3 w-3 text-violet-500 animate-pulse" />
            </div>
            <span className="text-[10px] text-muted-foreground">Talco AI Assistant</span>
          </div>
        </button>

        {isLoading && (
          <div className="px-3 py-6 text-xs text-muted-foreground flex items-center gap-2 justify-center">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        )}
        {!isLoading && (conversations?.length ?? 0) === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No conversations yet.<br />Click + to start one.
          </div>
        )}
        {(conversations ?? []).map((c) => {
          const unread = unreadByConv[c.id] ?? 0;
          const Icon = c.type === "group" ? Users : User;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors",
                activeId === c.id ? "bg-primary/10" : "hover:bg-muted/60"
              )}
            >
              <div className="relative h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[13px] truncate", unread > 0 ? "font-semibold" : "font-medium")}>{c.display_name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(c.last_message_at), { addSuffix: true })}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
