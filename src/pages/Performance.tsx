import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { DollarSign, Users, TrendingUp, Briefcase, Target, Receipt, AlertCircle } from "lucide-react";
import { PerformanceOverview } from "@/components/performance/PerformanceOverview";
import { TeamEffectiveness } from "@/components/performance/TeamEffectiveness";
import { IndividualPerformance } from "@/components/performance/IndividualPerformance";
import { Badge } from "@/components/ui/badge";

export default function Performance() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  // Check user access
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles-performance"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id);
      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
  });

  const canAccess = userRoles?.includes('super_admin') || 
                    userRoles?.includes('hr') || 
                    userRoles?.includes('finance');

  // Fetch all data
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-performance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: userRolesData = [] } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: payrollData = [] } = useQuery({
    queryKey: ["payroll-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .gte("month", startDate)
        .lte("month", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: reimbursements = [] } = useQuery({
    queryKey: ["reimbursements-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("reimbursements")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: shootings = [] } = useQuery({
    queryKey: ["shootings-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select("*")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: prospects = [] } = useQuery({
    queryKey: ["prospects-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["leave-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .gte("start_date", startDate)
        .lte("start_date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  const { data: ledgerEntries = [] } = useQuery({
    queryKey: ["ledger-performance", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccess,
  });

  // Get unique roles for filter
  const uniqueRoles = useMemo(() => {
    const roles = new Set(userRolesData.map(r => r.role));
    return Array.from(roles);
  }, [userRolesData]);

  // Map employees to their roles
  const employeeRoles = useMemo(() => {
    const map: Record<string, string[]> = {};
    userRolesData.forEach(r => {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r.role);
    });
    return map;
  }, [userRolesData]);

  // Filter data by month if selected
  const filterByMonth = (dateStr: string | null) => {
    if (!dateStr || selectedMonth === "all") return true;
    try {
      const date = parseISO(dateStr);
      return (date.getMonth() + 1).toString() === selectedMonth;
    } catch {
      return true;
    }
  };

  // Filter profiles by role
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (selectedRole === "all") return true;
      const roles = employeeRoles[p.id] || [];
      return roles.includes(selectedRole);
    });
  }, [profiles, selectedRole, employeeRoles]);

  // Generate year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const monthOptions = [
    { value: "all", label: "Semua Bulan" },
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
  ];

  if (rolesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!canAccess) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Akses Ditolak</h2>
          <p className="text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Performance Insight</h1>
            <p className="text-muted-foreground">Dashboard efektivitas biaya & kinerja tim</p>
          </div>
          <Badge variant="secondary" className="w-fit">Read-Only Dashboard</Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tahun</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bulan</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Role</SelectItem>
                    {uniqueRoles.map(role => (
                      <SelectItem key={role} value={role}>{role.replace('_', ' ').toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Karyawan</label>
                <Select value={selectedEmployee || "all"} onValueChange={(v) => setSelectedEmployee(v === "all" ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Karyawan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Karyawan</SelectItem>
                    {filteredProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Efektivitas Tim</TabsTrigger>
            <TabsTrigger value="individual">Efektivitas Individu</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <PerformanceOverview
              payrollData={payrollData}
              reimbursements={reimbursements}
              ledgerEntries={ledgerEntries}
              profiles={profiles}
              selectedMonth={selectedMonth}
              filterByMonth={filterByMonth}
            />
          </TabsContent>

          <TabsContent value="team">
            <TeamEffectiveness
              profiles={filteredProfiles}
              employeeRoles={employeeRoles}
              payrollData={payrollData}
              reimbursements={reimbursements}
              tasks={tasks}
              projects={projects}
              prospects={prospects}
              selectedMonth={selectedMonth}
              filterByMonth={filterByMonth}
            />
          </TabsContent>

          <TabsContent value="individual">
            <IndividualPerformance
              profiles={filteredProfiles}
              employeeRoles={employeeRoles}
              payrollData={payrollData}
              reimbursements={reimbursements}
              tasks={tasks}
              projects={projects}
              shootings={shootings}
              prospects={prospects}
              attendance={attendance}
              leaveRequests={leaveRequests}
              selectedMonth={selectedMonth}
              selectedEmployee={selectedEmployee}
              setSelectedEmployee={setSelectedEmployee}
              filterByMonth={filterByMonth}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
