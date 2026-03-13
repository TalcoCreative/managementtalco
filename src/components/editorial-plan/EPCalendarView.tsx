import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Slide {
  id: string;
  slide_order: number;
  status: "proposed" | "approved" | "revise" | "published";
  publish_date: string | null;
  channel: string | null;
  format: string | null;
}

interface EPCalendarViewProps {
  slides: Slide[];
  onSlideClick: (index: number) => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  proposed: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-200", dot: "bg-amber-500" },
  approved: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-200", dot: "bg-emerald-500" },
  revise: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-200", dot: "bg-orange-500" },
  published: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-200", dot: "bg-blue-500" },
};

const CHANNEL_ICONS: Record<string, string> = {
  instagram: "📸",
  tiktok: "🎵",
  youtube: "▶️",
  twitter: "𝕏",
  facebook: "📘",
  linkedin: "💼",
  threads: "🧵",
  other: "📌",
};

export function EPCalendarView({ slides, onSlideClick }: EPCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isMobile = useIsMobile();

  // Fetch slide_blocks to get titles
  const slideIds = slides.map(s => s.id);
  const { data: slideBlocks } = useQuery({
    queryKey: ["slide-blocks-titles", slideIds],
    queryFn: async () => {
      if (slideIds.length === 0) return [];
      const { data, error } = await supabase
        .from("slide_blocks")
        .select("slide_id, content")
        .in("slide_id", slideIds)
        .eq("block_type", "content_meta");
      if (error) throw error;
      return data;
    },
    enabled: slideIds.length > 0,
  });

  // Map slide_id -> title
  const slideTitles = useMemo(() => {
    const map = new Map<string, string>();
    slideBlocks?.forEach((block: any) => {
      const content = block.content as any;
      if (content?.title) {
        map.set(block.slide_id, content.title);
      } else if (content?.caption) {
        map.set(block.slide_id, content.caption.substring(0, 40));
      }
    });
    return map;
  }, [slideBlocks]);

  // Group slides by publish_date
  const slidesByDate = useMemo(() => {
    const map = new Map<string, { slide: Slide; index: number }[]>();
    slides.forEach((slide, index) => {
      if (slide.publish_date) {
        const dateKey = slide.publish_date;
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push({ slide, index });
      }
    });
    return map;
  }, [slides]);

  // Sorted list for mobile
  const sortedSlidesByDate = useMemo(() => {
    const entries = Array.from(slidesByDate.entries()).sort(([a], [b]) => a.localeCompare(b));
    return entries;
  }, [slidesByDate]);

  const scheduledCount = slides.filter(s => s.publish_date).length;
  const unscheduledCount = slides.filter(s => !s.publish_date).length;

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const dayNames = isMobile ? ["S", "S", "R", "K", "J", "S", "M"] : ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return (
    <Card className="p-3 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm sm:text-base">Jadwal Tayang</h3>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">{scheduledCount} terjadwal</Badge>
          {unscheduledCount > 0 && (
            <Badge variant="outline" className="text-muted-foreground text-[10px] sm:text-xs">{unscheduledCount} belum</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isMobile && (
            <div className="flex items-center gap-2 mr-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                Proposed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                Approved
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                Published
              </span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs sm:text-sm font-semibold min-w-[100px] sm:min-w-[120px] text-center">
            {format(currentMonth, "MMM yyyy", { locale: localeId })}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile legend */}
      {isMobile && (
        <div className="flex items-center gap-3 mb-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Proposed</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Approved</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Published</span>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/50">
          {dayNames.map((name, i) => (
            <div key={i} className="px-0.5 sm:px-2 py-1 sm:py-1.5 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground border-b">
              {name}
            </div>
          ))}
        </div>

        {/* Calendar weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((dayDate) => {
              const dateKey = format(dayDate, "yyyy-MM-dd");
              const daySlides = slidesByDate.get(dateKey) || [];
              const inMonth = isSameMonth(dayDate, currentMonth);
              const todayFlag = isToday(dayDate);

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "min-h-[48px] sm:min-h-[90px] p-0.5 sm:p-1 border-b border-r last:border-r-0 transition-colors",
                    !inMonth && "bg-muted/20",
                    todayFlag && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "text-[11px] sm:text-xs font-semibold mb-0 sm:mb-0.5 px-0.5 sm:px-1 tabular-nums",
                    !inMonth && "text-muted-foreground/40",
                    todayFlag && "text-primary font-bold"
                  )}>
                    {format(dayDate, "d")}
                  </div>
                  <div className="space-y-px sm:space-y-0.5">
                    {daySlides.slice(0, isMobile ? 2 : 99).map(({ slide, index }) => {
                      const colors = STATUS_COLORS[slide.status] || STATUS_COLORS.proposed;
                      const channelIcon = CHANNEL_ICONS[slide.channel || "other"] || "📌";
                      const title = slideTitles.get(slide.id);
                      return (
                        <button
                          key={slide.id}
                          onClick={() => onSlideClick(index)}
                          className={cn(
                            "w-full text-left px-0.5 sm:px-1.5 py-px sm:py-0.5 rounded leading-tight flex flex-col gap-0 hover:opacity-80 transition-opacity",
                            isMobile ? "text-[8px]" : "text-[10px]",
                            colors.bg,
                            colors.text
                          )}
                          title={`Slide ${slide.slide_order + 1} • ${slide.channel} • ${slide.format} • ${slide.status}${title ? ` • ${title}` : ''}`}
                        >
                          <div className="flex items-center gap-px sm:gap-1 truncate">
                            <span className={cn("h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full flex-shrink-0", colors.dot)} />
                            <span className="hidden sm:inline">{channelIcon}</span>
                            <span className="truncate">
                              {isMobile ? `S${slide.slide_order + 1}` : `S${slide.slide_order + 1} · ${slide.format}`}
                            </span>
                          </div>
                          {!isMobile && title && (
                            <span className="truncate pl-4 opacity-80 font-medium">{title}</span>
                          )}
                        </button>
                      );
                    })}
                    {isMobile && daySlides.length > 2 && (
                      <div className="text-[8px] text-muted-foreground text-center">+{daySlides.length - 2}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}
