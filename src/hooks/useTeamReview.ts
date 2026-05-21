import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamReviewSettings {
  id: string;
  enabled: boolean;
  open_day: number;
  deadline_day: number;
  require_before_clockin: boolean;
}

export interface TeamReviewQuestion {
  id: string;
  question_text: string;
  order_index: number;
  is_active: boolean;
}

export interface ReviewParticipant {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

// First day of current month in Asia/Jakarta TZ, returned as YYYY-MM-DD string
export function currentReviewMonth(): string {
  const now = new Date();
  // Convert to Jakarta time
  const jakarta = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = jakarta.getFullYear();
  const m = String(jakarta.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function currentJakartaDay(): number {
  const now = new Date();
  const jakarta = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  return jakarta.getDate();
}

export function useTeamReviewSettings() {
  return useQuery({
    queryKey: ["team-review-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_review_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as TeamReviewSettings | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeamReviewQuestions(activeOnly = true) {
  return useQuery({
    queryKey: ["team-review-questions", activeOnly],
    queryFn: async () => {
      let q = supabase.from("team_review_questions").select("*").order("order_index", { ascending: true });
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as TeamReviewQuestion[];
    },
  });
}

export function useReviewParticipants(excludeUserId?: string | null) {
  return useQuery({
    queryKey: ["team-review-participants", excludeUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, include_in_team_review")
        .eq("include_in_team_review", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || [])
        .filter((p) => p.id !== excludeUserId)
        .map(({ id, full_name, avatar_url }) => ({ id, full_name, avatar_url })) as ReviewParticipant[];
    },
    enabled: excludeUserId !== undefined,
  });
}

export function useMySubmission(userId?: string | null, month?: string) {
  return useQuery({
    queryKey: ["team-review-my-submission", userId, month],
    queryFn: async () => {
      if (!userId || !month) return null;
      const { data, error } = await supabase
        .from("team_review_submissions")
        .select("id, submitted_at")
        .eq("reviewer_id", userId)
        .eq("review_month", month)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!userId && !!month,
  });
}

export function useMyProfileIncluded(userId?: string | null) {
  return useQuery({
    queryKey: ["team-review-my-included", userId],
    queryFn: async () => {
      if (!userId) return true;
      const { data } = await supabase
        .from("profiles")
        .select("include_in_team_review")
        .eq("id", userId)
        .maybeSingle();
      return data?.include_in_team_review ?? true;
    },
    enabled: !!userId,
  });
}

export function isReviewWindowActive(settings: TeamReviewSettings | null | undefined): boolean {
  if (!settings || !settings.enabled) return false;
  const day = currentJakartaDay();
  const { open_day, deadline_day } = settings;
  if (open_day <= deadline_day) {
    return day >= open_day && day <= deadline_day;
  }
  // wraps month boundary (e.g. open 25, deadline 5)
  return day >= open_day || day <= deadline_day;
}
