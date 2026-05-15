import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationUnread {
  conversation_id: string;
  unread_count: number;
}

export function useChatUnread(userId?: string) {
  const [total, setTotal] = useState(0);
  const [perConversation, setPerConversation] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data: parts } = await supabase
      .from("chat_participants")
      .select("conversation_id,last_read_at")
      .eq("user_id", userId);

    if (!parts || parts.length === 0) {
      setTotal(0);
      setPerConversation({});
      return;
    }

    const counts: Record<string, number> = {};
    let sum = 0;
    await Promise.all(
      parts.map(async (p) => {
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", p.conversation_id)
          .neq("sender_id", userId)
          .gt("created_at", p.last_read_at);
        counts[p.conversation_id] = count ?? 0;
        sum += count ?? 0;
      })
    );
    setPerConversation(counts);
    setTotal(sum);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`chat-unread-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_participants", filter: `user_id=eq.${userId}` }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, refresh]);

  return { total, perConversation, refresh };
}
