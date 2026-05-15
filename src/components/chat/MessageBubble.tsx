import { useNavigate } from "react-router-dom";
import { renderContentTokens, MENTION_TYPE_ROUTE } from "@/lib/mention-search";
import { cn } from "@/lib/utils";

export function MessageBubble({
  content,
  mine,
  senderName,
  time,
  showSender,
}: {
  content: string;
  mine: boolean;
  senderName?: string;
  time: string;
  showSender?: boolean;
}) {
  const navigate = useNavigate();
  const tokens = renderContentTokens(content);

  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      {showSender && !mine && senderName && (
        <span className="text-[11px] text-muted-foreground px-2">{senderName}</span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words",
          mine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/70 text-foreground rounded-bl-md"
        )}
      >
        {tokens.map((t, i) => {
          if (t.kind === "text") return <span key={i} className="whitespace-pre-wrap">{t.text}</span>;
          return (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); navigate(MENTION_TYPE_ROUTE[t.type](t.id)); }}
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 mx-0.5 text-[12px] font-medium transition-colors",
                mine
                  ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                  : "bg-primary/15 hover:bg-primary/25 text-primary"
              )}
            >
              @{t.label}
            </button>
          );
        })}
      </div>
      <span className="text-[10px] text-muted-foreground px-2">{time}</span>
    </div>
  );
}
