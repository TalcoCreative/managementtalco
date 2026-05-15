import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Loader2, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MentionPicker } from "./MentionPicker";
import { MessageBubble } from "./MessageBubble";
import { buildMentionToken, extractMentionsFromContent, MentionResult } from "@/lib/mention-search";
import { format } from "date-fns";

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export function ConversationView({
  conversationId,
  currentUserId,
  onBack,
}: {
  conversationId: string;
  currentUserId: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Conversation header
  const { data: conv } = useQuery({
    queryKey: ["chat-conv-header", conversationId, currentUserId],
    queryFn: async () => {
      const { data: c } = await supabase
        .from("chat_conversations")
        .select("id,type,name")
        .eq("id", conversationId)
        .maybeSingle();
      if (!c) return null;
      let display = c.name ?? "Conversation";
      if (c.type === "dm") {
        const { data: parts } = await supabase
          .from("chat_participants")
          .select("user_id")
          .eq("conversation_id", conversationId)
          .neq("user_id", currentUserId);
        const otherId = parts?.[0]?.user_id;
        if (otherId) {
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", otherId).maybeSingle();
          display = prof?.full_name ?? "Direct message";
        }
      }
      return { ...c, display };
    },
  });

  // Messages
  const { data: messages, refetch } = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id,conversation_id,sender_id,content,created_at")
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as ChatMessage[];
    },
  });

  // Sender profiles
  const senderIds = useMemo(() => Array.from(new Set((messages ?? []).map((m) => m.sender_id))), [messages]);
  const { data: senders } = useQuery({
    queryKey: ["chat-msg-senders", conversationId, senderIds.join(",")],
    enabled: senderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name").in("id", senderIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.full_name ?? "Unknown"; });
      return map;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`chat-msgs-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, refetch]);

  // Mark as read on view
  useEffect(() => {
    const mark = async () => {
      await supabase
        .from("chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", currentUserId);
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    };
    mark();
  }, [conversationId, currentUserId, messages?.length, qc]);

  // Autoscroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Mention detection
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    const cur = e.target.selectionStart ?? v.length;
    const before = v.slice(0, cur);
    const at = before.lastIndexOf("@");
    if (at >= 0) {
      const after = before.slice(at + 1);
      if (!after.includes(" ") && !after.includes("\n") && after.length < 30) {
        setMentionQuery(after);
        setMentionStart(at);
        return;
      }
    }
    setMentionQuery(null);
    setMentionStart(-1);
  };

  const insertMention = (r: MentionResult) => {
    if (mentionStart < 0) return;
    const cur = taRef.current?.selectionStart ?? text.length;
    const token = buildMentionToken(r) + " ";
    const next = text.slice(0, mentionStart) + token + text.slice(cur);
    setText(next);
    setMentionQuery(null);
    setMentionStart(-1);
    setTimeout(() => {
      const pos = mentionStart + token.length;
      taRef.current?.focus();
      taRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from("chat_messages")
        .insert({ conversation_id: conversationId, sender_id: currentUserId, content })
        .select("id")
        .single();
      if (error || !msg) throw error;
      const mentions = extractMentionsFromContent(content);
      if (mentions.length > 0) {
        await supabase.from("chat_message_mentions").insert(
          mentions.map((m) => ({ message_id: msg.id, mention_type: m.type as any, entity_id: m.id }))
        );
      }
      setText("");
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null) return; // picker handles keys
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const Icon = conv?.type === "group" ? Users : User;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 bg-background/50">
        <button onClick={onBack} className="h-8 w-8 rounded-lg hover:bg-muted/60 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate">{conv?.display ?? "…"}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{conv?.type === "group" ? "Group chat" : "Direct message"}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {(messages ?? []).map((m, i) => {
          const prev = (messages ?? [])[i - 1];
          const showSender = conv?.type === "group" && (!prev || prev.sender_id !== m.sender_id);
          return (
            <MessageBubble
              key={m.id}
              content={m.content}
              mine={m.sender_id === currentUserId}
              senderName={senders?.[m.sender_id]}
              time={format(new Date(m.created_at), "HH:mm")}
              showSender={showSender}
            />
          );
        })}
        {(messages?.length ?? 0) === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            No messages yet. Say hi 👋
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/30 p-3 relative">
        {mentionQuery !== null && (
          <MentionPicker
            query={mentionQuery}
            onSelect={insertMention}
            onClose={() => { setMentionQuery(null); setMentionStart(-1); }}
          />
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={taRef}
            value={text}
            onChange={handleChange}
            onKeyDown={onKey}
            placeholder="Type @ to mention people, tasks, projects…"
            rows={1}
            className="min-h-[42px] max-h-[120px] resize-none rounded-xl text-sm py-2.5 px-3.5"
          />
          <Button
            size="icon"
            onClick={send}
            disabled={!text.trim() || sending}
            className="h-[42px] w-[42px] rounded-xl flex-shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
