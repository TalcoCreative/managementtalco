import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MoodSelector } from "@/components/attendance/MoodSelector";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export function MoodNudge() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: attendance } = useQuery({
    queryKey: ["today-attendance-mood"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      const { data } = await supabase
        .from("attendance")
        .select("id, mood, clock_in")
        .eq("user_id", session.session.user.id)
        .eq("date", today)
        .maybeSingle();
      return data;
    },
  });

  // Only show if clocked in but no mood set
  if (!attendance?.clock_in || attendance?.mood) return null;

  const handleSave = async () => {
    if (!selectedMood || !attendance) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("attendance")
        .update({ mood: selectedMood } as any)
        .eq("id", attendance.id);
      if (error) throw error;
      toast.success("Mood tersimpan! 🎉");
      queryClient.invalidateQueries({ queryKey: ["today-attendance-mood"] });
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["team-moods-today"] });
    } catch {
      toast.error("Gagal menyimpan mood");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-primary">Kamu belum pilih mood hari ini!</p>
      </div>
      <MoodSelector value={selectedMood} onChange={setSelectedMood} disabled={saving} />
      {selectedMood && (
        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
          Simpan Mood
        </Button>
      )}
    </div>
  );
}
