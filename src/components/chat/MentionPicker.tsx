import { useEffect, useState } from "react";
import { searchMentions, MentionResult, MENTION_TYPE_LABEL } from "@/lib/mention-search";
import { cn } from "@/lib/utils";
import { Loader2, User, CheckSquare, Briefcase, Video, CalendarClock, PartyPopper, Building2, UserPlus, Star, FileText } from "lucide-react";

const ICONS: Record<string, any> = {
  user: User, task: CheckSquare, project: Briefcase, shooting: Video,
  meeting: CalendarClock, event: PartyPopper, client: Building2,
  prospect: UserPlus, kol: Star, editorial_plan: FileText,
};

export function MentionPicker({
  query,
  onSelect,
  onClose,
}: {
  query: string;
  onSelect: (r: MentionResult) => void;
  onClose: () => void;
}) {
  const [results, setResults] = useState<MentionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchMentions(query, 5);
      if (!cancelled) {
        setResults(r);
        setActive(0);
        setLoading(false);
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (results.length === 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); onSelect(results[active]); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [results, active, onSelect, onClose]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 max-h-72 overflow-y-auto rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-soft-xl z-50">
      {loading && (
        <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Searching…
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="px-3 py-3 text-xs text-muted-foreground">No matches</div>
      )}
      {results.map((r, i) => {
        const Icon = ICONS[r.type] ?? User;
        return (
          <button
            key={`${r.type}-${r.id}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => onSelect(r)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
              i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
            )}
          >
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{r.label}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{MENTION_TYPE_LABEL[r.type]}</span>
          </button>
        );
      })}
    </div>
  );
}
