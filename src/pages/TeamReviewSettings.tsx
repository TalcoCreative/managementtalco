import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, ShieldCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useTeamReviewSettings, useTeamReviewQuestions } from "@/hooks/useTeamReview";

export default function TeamReviewSettings() {
  const { isSuperAdmin, isLoading: permsLoading } = usePermissions();
  const qc = useQueryClient();
  const { data: settings, isLoading: setLoading } = useTeamReviewSettings();
  const { data: questions, isLoading: qLoading } = useTeamReviewQuestions(false);

  // HR check
  const { data: isHr } = useQuery({
    queryKey: ["check-hr-role"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", s.session.user.id);
      return (data || []).some((r) => r.role === "hr" || r.role === "super_admin");
    },
  });

  const [newQ, setNewQ] = useState("");

  if (permsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }
  if (!isSuperAdmin && !isHr) return <Navigate to="/" replace />;

  const saveSettings = async (patch: Partial<{ enabled: boolean; open_day: number; deadline_day: number; require_before_clockin: boolean }>) => {
    if (!settings) return;
    const { error } = await supabase.from("team_review_settings").update(patch).eq("id", settings.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team-review-settings"] });
    toast.success("Saved");
  };

  const addQuestion = async () => {
    if (!newQ.trim()) return;
    const maxOrder = Math.max(0, ...(questions || []).map((q) => q.order_index));
    const { error } = await supabase
      .from("team_review_questions")
      .insert({ question_text: newQ.trim(), order_index: maxOrder + 1 });
    if (error) return toast.error(error.message);
    setNewQ("");
    qc.invalidateQueries({ queryKey: ["team-review-questions"] });
  };

  const updateQuestion = async (id: string, patch: any) => {
    const { error } = await supabase.from("team_review_questions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team-review-questions"] });
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("team_review_questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team-review-questions"] });
  };

  const move = async (id: string, dir: -1 | 1) => {
    if (!questions) return;
    const idx = questions.findIndex((q) => q.id === id);
    const swap = questions[idx + dir];
    if (!swap) return;
    await supabase.from("team_review_questions").update({ order_index: swap.order_index }).eq("id", id);
    await supabase.from("team_review_questions").update({ order_index: questions[idx].order_index }).eq("id", swap.id);
    qc.invalidateQueries({ queryKey: ["team-review-questions"] });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team Review Settings</h1>
            <p className="text-sm text-muted-foreground">Configure the confidential monthly peer review.</p>
          </div>
        </div>

        <Card className="rounded-3xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>Enable, schedule and policy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 p-4">
              <div>
                <p className="text-sm font-medium">Enable Monthly Team Review</p>
                <p className="text-xs text-muted-foreground">When off, no popup ever appears.</p>
              </div>
              <Switch checked={!!settings?.enabled} onCheckedChange={(v) => saveSettings({ enabled: v })} disabled={setLoading} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Open day of month</Label>
                <Input
                  type="number" min={1} max={31}
                  defaultValue={settings?.open_day ?? 25}
                  onBlur={(e) => saveSettings({ open_day: Number(e.target.value) })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Deadline day of month</Label>
                <Input
                  type="number" min={1} max={31}
                  defaultValue={settings?.deadline_day ?? 30}
                  onBlur={(e) => saveSettings({ deadline_day: Number(e.target.value) })}
                  className="rounded-xl mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Require Review Before Clock-In</p>
                  <p className="text-xs text-muted-foreground">Block clock-in until review is submitted.</p>
                </div>
              </div>
              <Switch
                checked={!!settings?.require_before_clockin}
                onCheckedChange={(v) => saveSettings({ require_before_clockin: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
            <CardDescription>Each question uses a 1–5 rating scale (Strongly Disagree → Strongly Agree).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {qLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              questions?.map((q, i) => (
                <div key={q.id} className="rounded-2xl border border-border/50 p-3 flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(q.id, -1)} disabled={i === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(q.id, 1)} disabled={i === (questions?.length ?? 0) - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    defaultValue={q.question_text}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== q.question_text) {
                        updateQuestion(q.id, { question_text: e.target.value.trim() });
                      }
                    }}
                    rows={2}
                    className="flex-1 rounded-xl resize-none bg-background"
                  />
                  <div className="flex flex-col gap-2 items-end">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Checkbox checked={q.is_active} onCheckedChange={(v) => updateQuestion(q.id, { is_active: !!v })} />
                      Active
                    </label>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteQuestion(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}

            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Add a new question…"
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && addQuestion()}
              />
              <Button onClick={addQuestion} className="rounded-xl">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <ParticipantsManager />
      </div>
    </AppLayout>
  );
}

function ParticipantsManager() {
  const qc = useQueryClient();
  const { data: people, isLoading } = useQuery({
    queryKey: ["team-review-all-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, include_in_team_review")
        .order("full_name", { ascending: true });
      return data || [];
    },
  });

  const toggle = async (id: string, val: boolean) => {
    const { error } = await supabase.from("profiles").update({ include_in_team_review: val }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team-review-all-profiles"] });
    qc.invalidateQueries({ queryKey: ["team-review-participants"] });
  };

  return (
    <Card className="rounded-3xl border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Review Participants</CardTitle>
        <CardDescription>Uncheck interns, freelancers, vendors, or probation employees to exclude them.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {people?.map((p) => (
              <label key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition">
                <span className="text-sm truncate">{p.full_name || "—"}</span>
                <Switch
                  checked={!!p.include_in_team_review}
                  onCheckedChange={(v) => toggle(p.id, v)}
                />
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
