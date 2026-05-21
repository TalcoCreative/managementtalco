import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Sparkles, ShieldCheck, ArrowRight, ArrowLeft, Check } from "lucide-react";
import {
  currentReviewMonth,
  isReviewWindowActive,
  useMyProfileIncluded,
  useMySubmission,
  useReviewParticipants,
  useTeamReviewQuestions,
  useTeamReviewSettings,
} from "@/hooks/useTeamReview";

interface DraftPayload {
  // key: `${userId}:${questionId}` -> score; key: `${userId}:comment` -> text
  answers: Record<string, number>;
  comments: Record<string, string>;
  cursor: number; // current participant index
}

interface Props {
  userId: string;
}

export function TeamReviewOverlay({ userId }: Props) {
  const qc = useQueryClient();
  const month = currentReviewMonth();
  const { data: settings, isLoading: settingsLoading } = useTeamReviewSettings();
  const { data: included, isLoading: incLoading } = useMyProfileIncluded(userId);
  const { data: submission, isLoading: subLoading } = useMySubmission(userId, month);
  const { data: questions, isLoading: qLoading } = useTeamReviewQuestions(true);
  const { data: participants, isLoading: pLoading } = useReviewParticipants(userId);

  const active = isReviewWindowActive(settings);
  const shouldShow =
    !settingsLoading &&
    !incLoading &&
    !subLoading &&
    !qLoading &&
    !pLoading &&
    active &&
    included &&
    !submission &&
    (participants?.length ?? 0) > 0 &&
    (questions?.length ?? 0) > 0;

  const [started, setStarted] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft
  useEffect(() => {
    if (!shouldShow || draftLoaded) return;
    (async () => {
      const { data } = await supabase
        .from("team_review_drafts")
        .select("payload")
        .eq("reviewer_id", userId)
        .eq("review_month", month)
        .maybeSingle();
      if (data?.payload) {
        const p = data.payload as DraftPayload;
        setAnswers(p.answers || {});
        setComments(p.comments || {});
        setCursor(p.cursor ?? 0);
      }
      setDraftLoaded(true);
    })();
  }, [shouldShow, draftLoaded, userId, month]);

  // Autosave (debounced)
  useEffect(() => {
    if (!shouldShow || !draftLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const payload: DraftPayload = { answers, comments, cursor };
      await supabase
        .from("team_review_drafts")
        .upsert({ reviewer_id: userId, review_month: month, payload }, { onConflict: "reviewer_id,review_month" });
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, comments, cursor, shouldShow, draftLoaded, userId, month]);

  const totalSteps = (participants?.length ?? 0) + 1; // +1 for review/summary step
  const progressPct = useMemo(() => {
    if (!participants || !questions) return 0;
    const total = participants.length * questions.length;
    const done = participants.reduce((acc, p) => {
      return acc + questions.filter((q) => answers[`${p.id}:${q.id}`]).length;
    }, 0);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }, [participants, questions, answers]);

  if (!shouldShow) return null;

  const currentParticipant = participants?.[cursor];
  const onSummary = cursor >= (participants?.length ?? 0);
  const canRequireOnly = settings?.require_before_clockin;

  const setScore = (uid: string, qid: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [`${uid}:${qid}`]: score }));
  };
  const setComment = (uid: string, text: string) => {
    setComments((prev) => ({ ...prev, [uid]: text }));
  };

  const participantComplete = (uid: string) =>
    !!questions && questions.every((q) => answers[`${uid}:${q.id}`]);

  const allComplete =
    !!participants &&
    !!questions &&
    participants.every((p) => participantComplete(p.id));

  const handleSubmit = async () => {
    if (!participants || !questions) return;
    if (!allComplete) {
      toast.error("Please rate every question for every teammate.");
      return;
    }
    setSubmitting(true);
    try {
      // Create submission
      const { data: sub, error: subErr } = await supabase
        .from("team_review_submissions")
        .insert({ reviewer_id: userId, review_month: month })
        .select("id")
        .single();
      if (subErr) throw subErr;

      // Build answer rows
      const rows: any[] = [];
      participants.forEach((p) => {
        questions.forEach((q) => {
          rows.push({
            submission_id: sub.id,
            reviewed_user_id: p.id,
            question_id: q.id,
            review_month: month,
            score: answers[`${p.id}:${q.id}`],
            comment: comments[p.id] || null,
          });
        });
      });

      const { error: ansErr } = await supabase.from("team_review_answers").insert(rows);
      if (ansErr) throw ansErr;

      // Clear draft
      await supabase
        .from("team_review_drafts")
        .delete()
        .eq("reviewer_id", userId)
        .eq("review_month", month);

      toast.success("Thank you! Your review is anonymous and confidential.");
      qc.invalidateQueries({ queryKey: ["team-review-my-submission"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 backdrop-blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%), radial-gradient(ellipse 60% 80% at 50% 100%, hsl(var(--accent) / 0.15), transparent 70%), hsl(var(--background) / 0.85)",
        }}
      />

      <div className="relative w-full max-w-2xl max-h-[92dvh] overflow-hidden flex flex-col rounded-3xl border border-border/40 bg-card/95 shadow-2xl backdrop-blur-xl">
        {/* Glow ring */}
        <div className="pointer-events-none absolute -inset-px rounded-3xl"
             style={{
               background:
                 "linear-gradient(135deg, hsl(var(--primary) / 0.5), transparent 40%, hsl(var(--accent) / 0.4))",
               WebkitMask:
                 "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
               WebkitMaskComposite: "xor",
               padding: "1px",
             }}
        />

        {!started ? (
          // Welcome screen
          <div className="flex-1 overflow-y-auto p-8 sm:p-10 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
              Monthly Team Review
            </h1>
            <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
              Take a quiet moment to share honest feedback about your teammates. Your
              answers are completely anonymous and visible only to HR & leadership.
            </p>
            <div className="grid gap-3 w-full max-w-md mb-8">
              <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/30 p-4 text-left">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">100% anonymous</p>
                  <p className="text-xs text-muted-foreground">No one will ever see your name attached to a rating.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/30 p-4 text-left">
                <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">~{Math.max(1, Math.round((participants?.length ?? 0) * (questions?.length ?? 0) * 0.15))} minutes</p>
                  <p className="text-xs text-muted-foreground">
                    {participants?.length ?? 0} teammates · {questions?.length ?? 0} questions each
                  </p>
                </div>
              </div>
            </div>
            <Button size="lg" className="w-full max-w-md rounded-2xl h-12 text-base" onClick={() => setStarted(true)}>
              Begin Review
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : onSummary ? (
          // Summary
          <div className="flex-1 overflow-y-auto p-8 sm:p-10">
            <h2 className="text-2xl font-semibold mb-2">Almost done</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Review your progress. You can go back to adjust any rating.
            </p>
            <div className="space-y-2 mb-8">
              {participants?.map((p, i) => {
                const done = participantComplete(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setCursor(i)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/30 hover:bg-muted/60 transition p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback>{(p.full_name || "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{p.full_name || "Teammate"}</span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {done ? "Complete" : "Pending"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-2xl" onClick={() => setCursor((participants?.length ?? 1) - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                className="flex-1 rounded-2xl h-11"
                onClick={handleSubmit}
                disabled={!allComplete || submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Submit anonymously
              </Button>
            </div>
          </div>
        ) : (
          // Per-participant question screen
          <>
            <div className="p-5 sm:p-6 border-b border-border/40">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                    <AvatarImage src={currentParticipant?.avatar_url || undefined} />
                    <AvatarFallback>{(currentParticipant?.full_name || "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Reviewing</p>
                    <p className="text-base font-semibold truncate">{currentParticipant?.full_name}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {cursor + 1} / {participants?.length}
                </span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {questions?.map((q) => {
                const key = `${currentParticipant!.id}:${q.id}`;
                const value = answers[key];
                return (
                  <div key={q.id} className="rounded-2xl border border-border/50 bg-muted/20 p-4 sm:p-5">
                    <p className="text-sm font-medium mb-4 leading-relaxed">{q.question_text}</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const selected = value === n;
                        return (
                          <button
                            key={n}
                            onClick={() => setScore(currentParticipant!.id, q.id, n)}
                            className={`h-11 rounded-xl text-sm font-semibold transition-all ${
                              selected
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105"
                                : "bg-background hover:bg-muted border border-border"
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-1">
                      <span>Strongly disagree</span>
                      <span>Strongly agree</span>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 sm:p-5">
                <p className="text-sm font-medium mb-2">Optional anonymous note</p>
                <Textarea
                  rows={3}
                  placeholder="Any constructive feedback for this teammate? (visible to HR only, never linked to you)"
                  value={comments[currentParticipant!.id] || ""}
                  onChange={(e) => setComment(currentParticipant!.id, e.target.value)}
                  className="rounded-xl resize-none bg-background/80"
                />
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t border-border/40 flex items-center gap-3">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
                disabled={cursor === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                className="flex-1 rounded-2xl h-11"
                onClick={() => setCursor((c) => c + 1)}
                disabled={!participantComplete(currentParticipant!.id)}
              >
                {cursor === (participants?.length ?? 0) - 1 ? "Review summary" : "Next teammate"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {!canRequireOnly && started && (
          <button
            onClick={() => {
              // optimistic close: re-show on next render only if shouldShow again; for now hide via setStarted false won't suffice.
              // We just hide overlay session-locally:
              sessionStorage.setItem("team-review-skipped", month);
              window.location.reload();
            }}
            className="absolute top-3 right-3 text-xs text-muted-foreground hover:text-foreground transition px-3 py-1.5 rounded-full hover:bg-muted"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

// Wrapper to honor "skip for now" session opt-out
export function TeamReviewGate({ userId }: { userId: string | null | undefined }) {
  const month = currentReviewMonth();
  if (!userId) return null;
  if (typeof window !== "undefined" && sessionStorage.getItem("team-review-skipped") === month) {
    return null;
  }
  return <TeamReviewOverlay userId={userId} />;
}
