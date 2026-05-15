import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { NewConversationDialog } from "./NewConversationDialog";
import { useChatUnread } from "@/hooks/useChatUnread";
import { cn } from "@/lib/utils";

export function ChatPopup() {
  const [open, setOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["chat-current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ?? null;
    },
  });
  const userId = currentUser?.id;
  const { total, perConversation } = useChatUnread(userId);

  // Listen to global open events
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const detail = (e as CustomEvent).detail as { conversationId?: string } | undefined;
      if (detail?.conversationId) setActiveConv(detail.conversationId);
    };
    window.addEventListener("open-chat", onOpen);
    return () => window.removeEventListener("open-chat", onOpen);
  }, []);

  // Auto-open from ?chat=<id> query param (push notification deep link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get("chat");
    if (chatId) {
      setOpen(true);
      setActiveConv(chatId);
    }
  }, []);

  if (!userId) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "fixed z-40 h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center",
            "right-4 bottom-4 md:right-6 md:bottom-6",
            "[bottom:calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:[bottom:1.5rem]"
          )}
          title="Messages"
        >
          <MessageCircle className="h-6 w-6" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className={cn(
            "fixed z-40 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl flex overflow-hidden",
            "right-3 left-3 md:left-auto md:right-6",
            "h-[min(620px,calc(100dvh-7rem))] md:h-[min(640px,calc(100dvh-5rem))]",
            "w-auto md:w-[680px]",
            "[bottom:calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:[bottom:1.5rem]"
          )}
        >
          {/* Sidebar list (hide when conversation open on mobile) */}
          <div className={cn(
            "w-full md:w-[260px] md:border-r border-border/30 flex flex-col bg-muted/20",
            activeConv && "hidden md:flex"
          )}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-white" />
                </div>
                <span className="text-[13px] font-semibold">Chat</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <Minimize2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <ConversationList
              currentUserId={userId}
              unreadByConv={perConversation}
              activeId={activeConv ?? undefined}
              onSelect={setActiveConv}
              onNewClick={() => setNewOpen(true)}
            />
          </div>

          {/* Conversation pane */}
          <div className={cn("flex-1 flex flex-col min-w-0", !activeConv && "hidden md:flex")}>
            {activeConv ? (
              <ConversationView
                conversationId={activeConv}
                currentUserId={userId}
                onBack={() => setActiveConv(null)}
              />
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

          {/* Desktop close button */}
          <button
            onClick={() => setOpen(false)}
            className="hidden md:flex absolute top-2 right-2 h-7 w-7 rounded-lg hover:bg-muted/60 items-center justify-center"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <NewConversationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        currentUserId={userId}
        onCreated={(id) => { setActiveConv(id); setOpen(true); }}
      />
    </>
  );
}
