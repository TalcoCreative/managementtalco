import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Bot, User, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIChatPopup() {
  const { isSuperAdmin } = usePermissions();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  

  // Snap-to-corner drag state
  const [iconCorner, setIconCorner] = useState<"tl" | "tr" | "bl" | "br">("br");
  const [chatCorner, setChatCorner] = useState<"tl" | "tr" | "bl" | "br">("br");
  const dragInfo = useRef<{ startX: number; startY: number; dragged: boolean; target: "icon" | "chat" } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);

  const ICON_SIZE = 56;
  const ICON_MARGIN = 16;
  const CHAT_MARGIN = 12;

  // Corner positions for icon
  const getIconCornerPos = useCallback((corner: string) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const m = ICON_MARGIN;
    const bottomOffset = window.innerWidth < 768 ? 80 : m; // above mobile nav
    switch (corner) {
      case "tl": return { x: m, y: m };
      case "tr": return { x: w - ICON_SIZE - m, y: m };
      case "bl": return { x: m, y: h - ICON_SIZE - bottomOffset };
      case "br": default: return { x: w - ICON_SIZE - m, y: h - ICON_SIZE - bottomOffset };
    }
  }, []);

  // Corner positions for chat window
  const getChatCornerStyle = useCallback((corner: string): React.CSSProperties => {
    const m = CHAT_MARGIN;
    const style: React.CSSProperties = {};
    if (corner.includes("t")) { style.top = m; style.bottom = "auto"; }
    else { style.bottom = window.innerWidth < 768 ? 72 : m; style.top = "auto"; }
    if (corner.includes("l")) { style.left = m; style.right = "auto"; }
    else { style.right = m; style.left = "auto"; }
    return style;
  }, []);

  const getNearestCorner = useCallback((cx: number, cy: number): "tl" | "tr" | "bl" | "br" => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isLeft = cx < w / 2;
    const isTop = cy < h / 2;
    if (isTop && isLeft) return "tl";
    if (isTop && !isLeft) return "tr";
    if (!isTop && isLeft) return "bl";
    return "br";
  }, []);

  // Window-level drag listeners
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragInfo.current) return;
      const dx = e.clientX - dragInfo.current.startX;
      const dy = e.clientY - dragInfo.current.startY;
      if (!dragInfo.current.dragged && Math.abs(dx) + Math.abs(dy) > 8) {
        dragInfo.current.dragged = true;
      }
      if (dragInfo.current.dragged) {
        setDragOffset({ dx, dy });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!dragInfo.current) return;
      if (dragInfo.current.dragged) {
        const corner = getNearestCorner(e.clientX, e.clientY);
        if (dragInfo.current.target === "icon") setIconCorner(corner);
        else setChatCorner(corner);
      }
      dragInfo.current = null;
      setDragOffset(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [getNearestCorner]);

  const startDrag = useCallback((e: React.PointerEvent, target: "icon" | "chat") => {
    e.preventDefault();
    dragInfo.current = { startX: e.clientX, startY: e.clientY, dragged: false, target };
  }, []);

  const handleIconPointerDown = useCallback((e: React.PointerEvent) => {
    startDrag(e, "icon");
  }, [startDrag]);

  const handleIconClick = useCallback(() => {
    if (!dragInfo.current?.dragged) setOpen(true);
  }, []);

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    startDrag(e, "chat");
  }, [startDrag]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isSuperAdmin) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await (await import("@/integrations/supabase/client")).supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
            );
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {}
        }
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const iconBasePos = getIconCornerPos(iconCorner);
  const isDraggingIcon = dragOffset && dragInfo.current?.target === "icon";
  const isDraggingChat = dragOffset && dragInfo.current?.target === "chat";

  if (!open) {
    const iconStyle: React.CSSProperties = isDraggingIcon
      ? { left: iconBasePos.x + dragOffset.dx, top: iconBasePos.y + dragOffset.dy, transition: "none" }
      : { left: iconBasePos.x, top: iconBasePos.y, transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)" };

    return (
      <button
        onPointerDown={handleIconPointerDown}
        onClick={handleIconClick}
        className="fixed z-50 h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center touch-none select-none"
        style={iconStyle}
        title="Tassa — Talco Support Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  const chatBaseStyle = getChatCornerStyle(chatCorner);
  const chatStyle: React.CSSProperties = isDraggingChat
    ? { ...chatBaseStyle, transform: `translate(${dragOffset.dx}px, ${dragOffset.dy}px)`, transition: "none" }
    : { ...chatBaseStyle, transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)" };

  return (
    <div
      className="fixed z-50 w-[calc(100vw-1.5rem)] max-w-[420px] h-[min(520px,calc(100dvh-6rem))] sm:h-[min(600px,calc(100dvh-5rem))] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden"
      style={chatStyle}
    >
      {/* Draggable Header */}
      <div
        className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border-b border-border/20 cursor-grab active:cursor-grabbing select-none touch-none"
        ref={headerRef}
        onPointerDown={handleHeaderPointerDown}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              Tassa
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Talco Support Assistant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => { setOpen(false); setMessages([]); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600/15 to-indigo-600/15 flex items-center justify-center">
              <Bot className="h-7 w-7 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Tassa</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                Tanya soal tasks, finance, clients, performance, HR, atau data operasional lainnya.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted/60 text-foreground rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&_strong]:text-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/20 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanya Tassa..."
            className="min-h-[42px] max-h-[120px] resize-none rounded-xl border-border/30 bg-muted/30 text-sm py-2.5 px-3.5"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-[42px] w-[42px] rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 flex-shrink-0"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
