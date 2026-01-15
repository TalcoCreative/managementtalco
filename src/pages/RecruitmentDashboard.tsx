import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  PieChart,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { format, subDays, subMonths, differenceInDays, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Funnel,
  FunnelChart,
  LabelList,
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  screening_hr: "Screening HR",
  interview_user: "Interview User",
  interview_final: "Interview Final",
  offering: "Offering",
  hired: "Hired",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  applied: "#3b82f6",
  screening_hr: "#eab308",
  interview_user: "#f97316",
  interview_final: "#a855f7",
  offering: "#6366f1",
  hired: "#22c55e",
  rejected: "#ef4444",
};

const FUNNEL_STAGES = ["applied", "screening_hr", "interview_user", "interview_final", "offering", "hired"];

type DateRange = "7d" | "30d" | "90d" | "all";

export default function RecruitmentDashboard() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hrPicFilter, setHrPicFilter] = useState<string>("all");
  const [sourceFormFilter, setSourceFormFilter] = useState<string>("all");

  // Fetch candidates
  const { data: candidates = [] } = useQuery({
    queryKey: ["dashboard-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          *,
          hr_pic:profiles!candidates_hr_pic_id_fkey(id, full_name),
          source_form:recruitment_forms!candidates_source_form_id_fkey(id, name)
        `)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch status history for time-to-progress
  const { data: statusHistory = [] } = useQuery({
    queryKey: ["dashboard-status-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_status_history")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch HR users for filter
  const { data: hrUsers = [] } = useQuery({
    queryKey: ["hr-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner(id, full_name)
        `)
        .in("role", ["hr", "super_admin"]);
      if (error) throw error;
      return data?.map((r: any) => r.profiles) || [];
    },
  });

  // Fetch recruitment forms for filter
  const { data: recruitmentForms = [] } = useQuery({
    queryKey: ["recruitment-forms-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recruitment_forms")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate date range
  const dateRangeStart = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "7d": return subDays(now, 7);
      case "30d": return subDays(now, 30);
      case "90d": return subDays(now, 90);
      default: return new Date(0);
    }
  }, [dateRange]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const appliedDate = new Date(c.applied_at);
      const inDateRange = appliedDate >= dateRangeStart;
      const matchesPosition = positionFilter === "all" || c.position === positionFilter;
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesHrPic = hrPicFilter === "all" || c.hr_pic_id === hrPicFilter;
      const matchesSourceForm = sourceFormFilter === "all" || c.source_form_id === sourceFormFilter;
      return inDateRange && matchesPosition && matchesStatus && matchesHrPic && matchesSourceForm;
    });
  }, [candidates, dateRangeStart, positionFilter, statusFilter, hrPicFilter, sourceFormFilter]);

  // Get unique positions
  const positions = useMemo(() => {
    const unique = [...new Set(candidates.map((c) => c.position))];
    return unique.sort();
  }, [candidates]);

  // KPI Stats
  const stats = useMemo(() => {
    const total = filteredCandidates.length;
    const newCandidates = filteredCandidates.filter((c) => c.status === "applied").length;
    const inProcess = filteredCandidates.filter((c) =>
      ["screening_hr", "interview_user", "interview_final", "offering"].includes(c.status)
    ).length;
    const hired = filteredCandidates.filter((c) => c.status === "hired").length;
    const rejected = filteredCandidates.filter((c) => c.status === "rejected").length;
    return { total, newCandidates, inProcess, hired, rejected };
  }, [filteredCandidates]);

  // Funnel data
  const funnelData = useMemo(() => {
    const counts = FUNNEL_STAGES.map((stage, idx) => {
      // Count candidates who have reached at least this stage
      const count = filteredCandidates.filter((c) => {
        const stageIndex = FUNNEL_STAGES.indexOf(c.status);
        // Include hired in all stages they passed through
        if (c.status === "hired") return true;
        return stageIndex >= idx;
      }).length;
      return {
        stage: STATUS_LABELS[stage],
        value: count,
        fill: STATUS_COLORS[stage],
      };
    });

    // Calculate conversion rates
    return counts.map((item, idx) => ({
      ...item,
      conversion: idx === 0 ? 100 : counts[0].value > 0 ? Math.round((item.value / counts[0].value) * 100) : 0,
    }));
  }, [filteredCandidates]);

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCandidates.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || "#888",
    }));
  }, [filteredCandidates]);

  // Candidates per day/week
  const candidatesOverTime = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredCandidates.forEach((c) => {
      const date = format(new Date(c.applied_at), "dd MMM");
      grouped[date] = (grouped[date] || 0) + 1;
    });
    return Object.entries(grouped)
      .slice(-14)
      .map(([date, count]) => ({ date, count }));
  }, [filteredCandidates]);

  // Time to progress metrics
  const timeMetrics = useMemo(() => {
    const getAverageTime = (fromStatus: string, toStatus: string) => {
      const transitions: number[] = [];
      
      // Group history by candidate
      const byCandidate: Record<string, typeof statusHistory> = {};
      statusHistory.forEach((h) => {
        if (!byCandidate[h.candidate_id]) byCandidate[h.candidate_id] = [];
        byCandidate[h.candidate_id].push(h);
      });

      Object.values(byCandidate).forEach((history) => {
        const sorted = history.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        let fromTime: Date | null = null;
        sorted.forEach((h) => {
          if (h.new_status === fromStatus && !fromTime) {
            fromTime = new Date(h.created_at);
          }
          if (h.old_status === fromStatus && h.new_status === toStatus && fromTime) {
            const toTime = new Date(h.created_at);
            transitions.push(differenceInDays(toTime, fromTime));
            fromTime = null;
          }
        });
      });

      if (transitions.length === 0) return null;
      return Math.round(transitions.reduce((a, b) => a + b, 0) / transitions.length);
    };

    return {
      applyToScreening: getAverageTime("applied", "screening_hr"),
      screeningToInterview: getAverageTime("screening_hr", "interview_user"),
      interviewToHired: getAverageTime("interview_user", "hired"),
    };
  }, [statusHistory]);

  // HR PIC performance
  const hrPicStats = useMemo(() => {
    const stats: Record<string, { name: string; total: number; active: number; completed: number }> = {};
    
    filteredCandidates.forEach((c) => {
      if (c.hr_pic) {
        const picId = c.hr_pic.id;
        if (!stats[picId]) {
          stats[picId] = { name: c.hr_pic.full_name, total: 0, active: 0, completed: 0 };
        }
        stats[picId].total++;
        if (["hired", "rejected"].includes(c.status)) {
          stats[picId].completed++;
        } else {
          stats[picId].active++;
        }
      }
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [filteredCandidates]);

  // Need attention candidates (stuck > 7 days)
  const needAttention = useMemo(() => {
    const now = new Date();
    return filteredCandidates.filter((c) => {
      if (["hired", "rejected"].includes(c.status)) return false;
      const lastUpdate = new Date(c.updated_at);
      return differenceInDays(now, lastUpdate) > 7;
    });
  }, [filteredCandidates]);

  const handleKPIClick = (filter: string) => {
    if (filter === "all") {
      navigate("/recruitment");
    } else {
      navigate(`/recruitment?status=${filter}`);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Recruitment Dashboard</h1>
            <p className="text-muted-foreground">Overview rekrutmen real-time</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/recruitment")}>
            Lihat Kandidat
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Global Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 Hari</SelectItem>
                  <SelectItem value="30d">30 Hari</SelectItem>
                  <SelectItem value="90d">90 Hari</SelectItem>
                  <SelectItem value="all">Semua</SelectItem>
                </SelectContent>
              </Select>

              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Posisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Posisi</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={hrPicFilter} onValueChange={setHrPicFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="HR PIC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua HR</SelectItem>
                  {hrUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceFormFilter} onValueChange={setSourceFormFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Source Form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Form</SelectItem>
                  {recruitmentForms.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleKPIClick("all")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Kandidat</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleKPIClick("applied")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Baru</CardTitle>
              <UserPlus className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.newCandidates}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleKPIClick("screening_hr")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Dalam Proses</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.inProcess}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleKPIClick("hired")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Hired</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.hired}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleKPIClick("rejected")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Rejected</CardTitle>
              <UserX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Funnel Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recruitment Funnel
              </CardTitle>
              <CardDescription>Konversi tiap tahapan rekrutmen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {funnelData.map((item, idx) => (
                  <div key={item.stage} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.stage}</span>
                      <span className="font-medium">{item.value} ({item.conversion}%)</span>
                    </div>
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${item.conversion}%`,
                          backgroundColor: item.fill,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Status Distribution
              </CardTitle>
              <CardDescription>Breakdown kandidat per status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Candidates Over Time & Time Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Candidates Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Kandidat Masuk
              </CardTitle>
              <CardDescription>Jumlah kandidat per hari</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={candidatesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Time to Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time to Progress
              </CardTitle>
              <CardDescription>Rata-rata waktu antar tahapan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Applied → Screening HR</p>
                  <p className="text-xs text-muted-foreground">Waktu rata-rata proses awal</p>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {timeMetrics.applyToScreening ?? "-"} <span className="text-sm font-normal">hari</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Screening → Interview User</p>
                  <p className="text-xs text-muted-foreground">Waktu ke tahap interview</p>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {timeMetrics.screeningToInterview ?? "-"} <span className="text-sm font-normal">hari</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Interview → Hired</p>
                  <p className="text-xs text-muted-foreground">Waktu sampai hired</p>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {timeMetrics.interviewToHired ?? "-"} <span className="text-sm font-normal">hari</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* HR PIC Performance & Need Attention */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* HR PIC Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                HR PIC Performance
              </CardTitle>
              <CardDescription>Jumlah kandidat per HR PIC</CardDescription>
            </CardHeader>
            <CardContent>
              {hrPicStats.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Belum ada HR PIC yang di-assign
                </p>
              ) : (
                <div className="space-y-3">
                  {hrPicStats.map((hr) => (
                    <div key={hr.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{hr.name}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Aktif: {hr.active}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Selesai: {hr.completed}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-2xl font-bold">{hr.total}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Need Attention */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Need Attention
              </CardTitle>
              <CardDescription>Kandidat stuck &gt; 7 hari tanpa update</CardDescription>
            </CardHeader>
            <CardContent>
              {needAttention.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Tidak ada kandidat yang perlu perhatian 🎉
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {needAttention.slice(0, 10).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                      onClick={() => navigate(`/recruitment?candidate=${c.id}`)}
                    >
                      <div>
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">{c.position}</p>
                      </div>
                      <div className="text-right">
                        <Badge className={STATUS_COLORS[c.status]} variant="secondary">
                          {STATUS_LABELS[c.status]}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {differenceInDays(new Date(), new Date(c.updated_at))} hari
                        </p>
                      </div>
                    </div>
                  ))}
                  {needAttention.length > 10 && (
                    <p className="text-sm text-center text-muted-foreground">
                      +{needAttention.length - 10} lainnya
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
