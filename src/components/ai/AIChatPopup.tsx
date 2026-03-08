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
  const headerRef = useRef<HTMLDivElement>(null);

  // Drag state - shared for both icon and chat window
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [iconPos, setIconPos] = useState<{ x: number; y: number } | null>(null);
  const dragInfo = useRef<{ startX: number; startY: number; origX: number; origY: number; dragged: boolean } | null>(null);

  const getDefaultPos = useCallback(() => {
    const isMd = window.innerWidth >= 768;
    return {
      x: isMd ? window.innerWidth - 420 - 32 : 16,
      y: isMd ? window.innerHeight - 600 - 32 : 80,
    };
  }, []);

  const getDefaultIconPos = useCallback(() => ({
    x: window.innerWidth >= 768 ? window.innerWidth - 56 - 32 : window.innerWidth - 56 - 24,
    y: window.innerHeight >= 768 ? window.innerHeight - 56 - 32 : window.innerHeight - 56 - 24,
  }), []);

  useEffect(() => {
    if (open && !position) setPosition(getDefaultPos());
  }, [open, position, getDefaultPos]);

  // Window-level drag listeners
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragInfo.current) return;
      const dx = e.clientX - dragInfo.current.startX;
      const dy = e.clientY - dragInfo.current.startY;
      if (!dragInfo.current.dragged && Math.abs(dx) + Math.abs(dy) > 5) {
        dragInfo.current.dragged = true;
      }
      const setter = open ? setPosition : setIconPos;
      setter({
        x: Math.max(0, Math.min(window.innerWidth - 60, dragInfo.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragInfo.current.origY + dy)),
      });
    };
    const onUp = () => { dragInfo.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open]);

  const startDrag = useCallback((e: React.PointerEvent, origX: number, origY: number) => {
    e.preventDefault();
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
      dragged: false,
    };
  }, []);

  const handleIconPointerDown = useCallback((e: React.PointerEvent) => {
    const ip = iconPos ?? getDefaultIconPos();
    startDrag(e, ip.x, ip.y);
  }, [iconPos, getDefaultIconPos, startDrag]);

  const handleIconClick = useCallback(() => {
    // Only open if we didn't drag
    if (!dragInfo.current?.dragged) {
      setOpen(true);
    }
  }, []);

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const p = position ?? getDefaultPos();
    startDrag(e, p.x, p.y);
  }, [position, getDefaultPos, startDrag]);

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center md:bottom-8 md:right-8"
        title="Tassa — Talco Support Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  const pos = position ?? getDefaultPos();

  return (
    <div
      className="fixed z-50 w-[calc(100vw-2rem)] max-w-[420px] h-[min(600px,calc(100vh-6rem))] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y }}
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
