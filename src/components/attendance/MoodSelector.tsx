import { cn } from "@/lib/utils";

const MOODS = [
  { emoji: "😄", label: "Happy", value: "happy" },
  { emoji: "😊", label: "Good", value: "good" },
  { emoji: "😐", label: "Neutral", value: "neutral" },
  { emoji: "😔", label: "Sad", value: "sad" },
  { emoji: "😤", label: "Stressed", value: "stressed" },
];

interface MoodSelectorProps {
  value: string | null;
  onChange: (mood: string) => void;
  disabled?: boolean;
}

export function MoodSelector({ value, onChange, disabled }: MoodSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">How are you feeling today?</p>
      <div className="flex items-center justify-center gap-2">
        {MOODS.map((mood) => (
          <button
            key={mood.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mood.value)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200",
              "hover:bg-accent/60 active:scale-95",
              value === mood.value
                ? "bg-primary/10 ring-2 ring-primary/40 scale-110"
                : "bg-muted/30",
              disabled && "opacity-50 pointer-events-none"
            )}
          >
            <span className="text-2xl sm:text-3xl">{mood.emoji}</span>
            <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground leading-none">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function getMoodEmoji(mood: string | null): string {
  const found = MOODS.find((m) => m.value === mood);
  return found?.emoji || "😊";
}

export { MOODS };
