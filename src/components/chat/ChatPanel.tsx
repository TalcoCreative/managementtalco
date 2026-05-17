import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { NewConversationDialog } from "./NewConversationDialog";
import { TassaChatView } from "./TassaChatView";
import { useChatUnread } from "@/hooks/useChatUnread";
import { cn } from "@/lib/utils";

export const TASSA_CONV_ID = "__tassa_ai__";

interface ChatPanelProps {
  className?: string;
  embedded?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export function ChatPanel({ className, embedded = false, showCloseButton = false, onClose }: ChatPanelProps) {
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["chat-panel-current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ?? null;
    },
  });

  const userId = currentUser?.id;
  const { perConversation } = useChatUnread(userId);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { conversationId?: string } | undefined;
      if (detail?.conversationId) setActiveConv(detail.conversationId);
    };
    window.addEventListener("open-chat", onOpen);
    return () => window.removeEventListener("open-chat", onOpen);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get("chat");
    if (chatId) setActiveConv(chatId);
  }, []);

  if (!userId) return null;

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl flex overflow-hidden min-h-0",
          embedded ? "h-full w-full" : "h-[min(640px,calc(100dvh-5rem))] w-[680px]",
          className,
        )}
      >
        <div className={cn("w-full md:w-[260px] md:border-r border-border/30 flex flex-col bg-muted/20", activeConv && "hidden md:flex")}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[13px] font-semibold">Chat</span>
            </div>
            {showCloseButton && onClose && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <ConversationList
            currentUserId={userId}
            unreadByConv={perConversation}
            activeId={activeConv ?? undefined}
            onSelect={setActiveConv}
            onNewClick={() => setNewOpen(true)}
          />
        </div>

        <div className={cn("flex-1 flex flex-col min-w-0", !activeConv && "hidden md:flex")}>
          {activeConv === TASSA_CONV_ID ? (
            <TassaChatView onBack={() => setActiveConv(null)} />
          ) : activeConv ? (
            <ConversationView conversationId={activeConv} currentUserId={userId} onBack={() => setActiveConv(null)} />
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center text-center p-6">
              <div>
                <MessageCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="text-xs text-muted-foreground mt-1">Or start a new one with the + button</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewConversationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        currentUserId={userId}
        onCreated={(id) => setActiveConv(id)}
      />
    </>
  );
}