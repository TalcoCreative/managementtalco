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

export interface TeamReviewCycle {
  reviewMonth: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  today: {
    year: number;
    month: number;
    day: number;
  };
}

function getJakartaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value || 0),
    month: Number(parts.find((part) => part.type === "month")?.value || 1),
    day: Number(parts.find((part) => part.type === "day")?.value || 1),
  };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function shiftMonth(year: number, month: number, offset: number) {
  const cursor = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {
    year: cursor.getUTCFullYear(),
    month: cursor.getUTCMonth() + 1,
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function currentReviewMonth(date = new Date()): string {
  const { year, month } = getJakartaDateParts(date);
  return `${year}-${pad(month)}-01`;
}

export function currentJakartaDay(date = new Date()): number {
  return getJakartaDateParts(date).day;
}

export function getTeamReviewCycle(
  settings: TeamReviewSettings | null | undefined,
  date = new Date(),
): TeamReviewCycle {
  const today = getJakartaDateParts(date);

  if (!settings) {
    const monthKey = `${today.year}-${pad(today.month)}-01`;
    const todayKey = dateKey(today.year, today.month, today.day);
    return {
      reviewMonth: monthKey,
      startDate: todayKey,
      endDate: todayKey,
      isActive: false,
      today,
    };
  }

  const openDay = Math.max(1, Math.min(31, settings.open_day));
  const deadlineDay = Math.max(1, Math.min(31, settings.deadline_day));

  let startMonth = { year: today.year, month: today.month };
  let endMonth = { year: today.year, month: today.month };

  if (openDay > deadlineDay) {
    if (today.day >= openDay) {
      endMonth = shiftMonth(today.year, today.month, 1);
    } else {
      startMonth = shiftMonth(today.year, today.month, -1);
    }
  }

  const startDay = Math.min(openDay, getDaysInMonth(startMonth.year, startMonth.month));
  const endDay = Math.min(deadlineDay, getDaysInMonth(endMonth.year, endMonth.month));

  const startDate = dateOnly(startMonth.year, startMonth.month, startDay);
  const endDate = dateOnly(endMonth.year, endMonth.month, endDay);
  const todayDate = dateOnly(today.year, today.month, today.day);

  return {
    reviewMonth: `${startMonth.year}-${pad(startMonth.month)}-01`,
    startDate: dateKey(startMonth.year, startMonth.month, startDay),
    endDate: dateKey(endMonth.year, endMonth.month, endDay),
    isActive: !!settings.enabled && todayDate >= startDate && todayDate <= endDate,
    today,
  };
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
  return getTeamReviewCycle(settings).isActive;
}
