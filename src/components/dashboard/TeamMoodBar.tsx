import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getMoodEmoji } from "@/components/attendance/MoodSelector";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TeamMember {
  user_id: string;
  mood: string | null;
  clock_in: string | null;
  profile: { full_name: string } | null;
}

export function TeamMoodBar() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: teamMoods = [] } = useQuery({
    queryKey: ["team-moods-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("user_id, mood, clock_in, profiles:profiles!fk_attendance_user_profiles(full_name)")
        .eq("date", today)
        .not("clock_in", "is", null)
        .order("clock_in", { ascending: true });

      if (error) {
        console.error("Team mood error:", error);
        return [];
      }
      return (data || []).map((d: any) => ({
        user_id: d.user_id,
        mood: d.mood,
        clock_in: d.clock_in,
        profile: d.profiles,
      })) as TeamMember[];
    },
    refetchInterval: 60000,
  });

  if (teamMoods.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center -space-x-1.5">
          {teamMoods.slice(0, 12).map((member, i) => {
            const initials = member.profile?.full_name
              ?.split(" ")
              .map((w) => w[0])
              .join("")
              .substring(0, 2)
              .toUpperCase() || "?";
            const emoji = getMoodEmoji(member.mood);
            const clockInTime = member.clock_in
              ? format(new Date(member.clock_in), "HH:mm")
              : "";

            return (
              <Tooltip key={member.user_id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full",
                      "bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-background",
                      "cursor-pointer hover:scale-110 hover:z-10 transition-transform duration-200",
                      "ring-1 ring-border/30"
                    )}
                    style={{ zIndex: teamMoods.length - i }}
                  >
                    <span className="text-[10px] sm:text-xs font-bold text-foreground/70">
                      {initials}
                    </span>
                    {/* Mood emoji badge */}
                    <span className="absolute -bottom-0.5 -right-0.5 text-xs sm:text-sm leading-none drop-shadow-sm">
                      {emoji}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="text-center">
                    <p className="font-semibold">{member.profile?.full_name || "Unknown"}</p>
                    <p className="text-muted-foreground">
                      {emoji} {member.mood || "no mood"} · Clock in {clockInTime}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {teamMoods.length > 12 && (
            <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-muted border-2 border-background text-[10px] font-semibold text-muted-foreground">
              +{teamMoods.length - 12}
            </div>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}
