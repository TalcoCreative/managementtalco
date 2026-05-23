import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Users, TrendingUp, MessageSquare, ChevronLeft } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { getTeamReviewCycle, useMyProfileIncluded, useMySubmission, useReviewParticipants, useTeamReviewQuestions, useTeamReviewSettings } from "@/hooks/useTeamReview";
import { TeamReviewOverlay } from "@/components/team-review/TeamReviewOverlay";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";

export default function TeamReview() {
  const { isSuperAdmin, isLoading } = usePermissions();
  const { data: isHr, isLoading: hrLoading } = useQuery({
    queryKey: ["check-hr-role"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.session.user.id);
      return (data || []).some((r) => r.role === "hr" || r.role === "super_admin");
    },
  });

  if (isLoading || hrLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Dashboard canSeeAnalytics={!!isSuperAdmin || !!isHr} />
    </AppLayout>
  );
}

function Dashboard({ canSeeAnalytics }: { canSeeAnalytics: boolean }) {
  const { data: settings } = useTeamReviewSettings();
  const cycle = useMemo(() => getTeamReviewCycle(settings), [settings]);
  const month = cycle.reviewMonth;
  const { data: questions } = useTeamReviewQuestions(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const { data: session } = useQuery({
    queryKey: ["team-review-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });
  const currentUserId = session?.user?.id;
  const { data: included } = useMyProfileIncluded(currentUserId);
  const { data: mySubmission, isLoading: mySubmissionLoading } = useMySubmission(currentUserId, month);
  const { data: reviewParticipants } = useReviewParticipants(currentUserId);

  const reviewCanBeFilled =
    !!currentUserId &&
    cycle.isActive &&
    included &&
    !mySubmission &&
    (reviewParticipants?.length ?? 0) > 0 &&
    (questions?.filter((q) => q.is_active).length ?? 0) > 0;

  const { data: participants } = useQuery({
    queryKey: ["tr-all-participants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, include_in_team_review")
        .eq("include_in_team_review", true);
      return data || [];
    },
    enabled: canSeeAnalytics,
  });

  const { data: submissions } = useQuery({
    queryKey: ["tr-submissions", month],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_review_submissions")
        .select("reviewer_id, submitted_at")
        .eq("review_month", month);
      return data || [];
    },
    enabled: canSeeAnalytics,
  });

  const { data: answersThisMonth } = useQuery({
    queryKey: ["tr-answers-month", month],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_review_answers")
        .select("reviewed_user_id, question_id, score, comment")
        .eq("review_month", month);
      return data || [];
    },
    enabled: canSeeAnalytics,
  });

  const { data: trendData } = useQuery({
    queryKey: ["tr-trend"],
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("team_review_answers")
        .select("review_month, score")
        .gte("review_month", sinceStr);
      const map = new Map<string, { sum: number; n: number }>();
      (data || []).forEach((r: any) => {
        const k = String(r.review_month).slice(0, 7);
        const cur = map.get(k) || { sum: 0, n: 0 };
        cur.sum += r.score;
        cur.n += 1;
        map.set(k, cur);
      });
      return Array.from(map.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([m, v]) => ({ month: m, avg: Number((v.sum / v.n).toFixed(2)) }));
    },
    enabled: canSeeAnalytics,
  });

  const totalEligible = participants?.length ?? 0;
  const submittedSet = new Set((submissions || []).map((s) => s.reviewer_id));
  const completionPct = totalEligible === 0 ? 0 : Math.round((submittedSet.size / totalEligible) * 100);

  const pendingUsers = (participants || []).filter((p) => !submittedSet.has(p.id));

  const overallAvg = useMemo(() => {
    if (!answersThisMonth || answersThisMonth.length === 0) return 0;
    const sum = answersThisMonth.reduce((a, r: any) => a + r.score, 0);
    return Number((sum / answersThisMonth.length).toFixed(2));
  }, [answersThisMonth]);

  // Per-question averages
  const perQuestion = useMemo(() => {
    if (!questions || !answersThisMonth) return [];
    return questions.map((q) => {
      const rows = answersThisMonth.filter((r: any) => r.question_id === q.id);
      const avg = rows.length === 0 ? 0 : rows.reduce((a, r: any) => a + r.score, 0) / rows.length;
      return { label: q.question_text.length > 32 ? q.question_text.slice(0, 32) + "…" : q.question_text, avg: Number(avg.toFixed(2)) };
    });
  }, [questions, answersThisMonth]);

  // Per-user averages
  const perUser = useMemo(() => {
    if (!participants || !answersThisMonth) return [];
    return participants
      .map((p) => {
        const rows = answersThisMonth.filter((r: any) => r.reviewed_user_id === p.id);
        const avg = rows.length === 0 ? 0 : rows.reduce((a, r: any) => a + r.score, 0) / rows.length;
        return { ...p, avg: Number(avg.toFixed(2)), count: rows.length };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [participants, answersThisMonth]);

  if (canSeeAnalytics && selectedUser) {
    return (
      <UserDetail userId={selectedUser} onBack={() => setSelectedUser(null)} questions={questions || []} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Culture Insight</h1>
          <p className="text-sm text-muted-foreground">
            Confidential · {settings?.enabled ? "Active" : "Disabled"} · Month {month.slice(0, 7)}
          </p>
        </div>
      </div>

      <Card className="rounded-3xl border-border/50">
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Review window</p>
            <p className="text-xs text-muted-foreground">
              {cycle.startDate} → {cycle.endDate}
            </p>
          </div>
          {reviewCanBeFilled ? (
            <TeamReviewOverlay userId={currentUserId!} mode="embedded" />
          ) : (
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
              {mySubmissionLoading
                ? "Checking your submission status..."
                : mySubmission
                  ? "You have completed this month's confidential team review."
                  : !cycle.isActive
                    ? "This page is ready, but the review form will only open during the configured review window."
                    : !included
                      ? "Your account is currently excluded from this month's team review participants."
                      : "The form will appear here once active questions and teammates are available."}
            </div>
          )}
        </CardContent>
      </Card>

      {canSeeAnalytics && (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Completion" value={`${completionPct}%`} sub={`${submittedSet.size} / ${totalEligible}`} icon={Users} />
        <KPI label="Avg score" value={overallAvg.toFixed(2)} sub="out of 5.0" icon={TrendingUp} />
        <KPI label="Pending" value={String(pendingUsers.length)} sub="reviewers" icon={MessageSquare} />
        <KPI label="Questions" value={String(questions?.filter((q) => q.is_active).length ?? 0)} sub="active" icon={Sparkles} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
          <TabsTrigger value="per-question" className="rounded-xl">Per question</TabsTrigger>
          <TabsTrigger value="per-user" className="rounded-xl">Per teammate</TabsTrigger>
          <TabsTrigger value="pending" className="rounded-xl">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card className="rounded-3xl border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Monthly trend (avg score)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-border/50">
            <CardHeader><CardTitle className="text-base">Completion progress</CardTitle></CardHeader>
            <CardContent>
              <Progress value={completionPct} className="h-3" />
              <p className="text-xs text-muted-foreground mt-2">{submittedSet.size} of {totalEligible} teammates have submitted this month.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="per-question" className="mt-4">
          <Card className="rounded-3xl border-border/50">
            <CardHeader><CardTitle className="text-base">Average score per question</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perQuestion} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} width={200} />
                  <Tooltip contentStyle={{ borderRadius: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="per-user" className="mt-4 space-y-2">
          {perUser.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u.id)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card hover:bg-muted/40 transition p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback>{(u.full_name || "?").charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.count} ratings received</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-semibold tabular-nums">{u.avg.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">avg / 5</p>
              </div>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-2">
          {pendingUsers.length === 0 && <p className="text-sm text-muted-foreground">Everyone has submitted 🎉</p>}
          {pendingUsers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border/50 p-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback>{(p.full_name || "?").charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{p.full_name}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon }: { label: string; value: string; sub: string; icon: any }) {
  return (
    <Card className="rounded-3xl border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function UserDetail({ userId, onBack, questions }: { userId: string; onBack: () => void; questions: any[] }) {
  const { data: profile } = useQuery({
    queryKey: ["tr-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["tr-user-detail", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_review_answers")
        .select("review_month, score, comment, question_id")
        .eq("reviewed_user_id", userId);
      return data || [];
    },
  });

  const trend = useMemo(() => {
    if (!rows) return [];
    const map = new Map<string, { sum: number; n: number }>();
    rows.forEach((r: any) => {
      const k = String(r.review_month).slice(0, 7);
      const cur = map.get(k) || { sum: 0, n: 0 };
      cur.sum += r.score; cur.n += 1;
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([m, v]) => ({ month: m, avg: Number((v.sum / v.n).toFixed(2)) }));
  }, [rows]);

  const perQ = useMemo(() => {
    if (!rows) return [];
    return questions.map((q) => {
      const rs = rows.filter((r: any) => r.question_id === q.id);
      return {
        label: q.question_text.length > 32 ? q.question_text.slice(0, 32) + "…" : q.question_text,
        avg: rs.length === 0 ? 0 : Number((rs.reduce((a, r: any) => a + r.score, 0) / rs.length).toFixed(2)),
      };
    });
  }, [questions, rows]);

  const comments = (rows || []).filter((r: any) => r.comment).map((r: any) => ({ month: String(r.review_month).slice(0, 7), comment: r.comment }));

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to overview
      </button>
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback>{(profile?.full_name || "?").charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-semibold">{profile?.full_name || "—"}</h2>
          <p className="text-xs text-muted-foreground">{rows?.length ?? 0} anonymous ratings collected</p>
        </div>
      </div>

      <Card className="rounded-3xl border-border/50">
        <CardHeader><CardTitle className="text-base">Monthly trend</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/50">
        <CardHeader><CardTitle className="text-base">Per-question average</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perQ} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis type="category" dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} width={200} />
              <Tooltip contentStyle={{ borderRadius: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/50">
        <CardHeader><CardTitle className="text-base">Anonymous comments</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments left for this teammate.</p>}
          {comments.map((c, i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">{c.month}</p>
              <p className="text-sm leading-relaxed">{c.comment}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
