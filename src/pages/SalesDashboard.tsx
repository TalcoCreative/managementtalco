import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  Clock, 
  Award,
  Calendar as CalendarIcon,
  Filter,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SalesLineChart } from "@/components/sales/SalesLineChart";
import { SalesFunnelChart } from "@/components/sales/SalesFunnelChart";
import { SalesBarChart } from "@/components/sales/SalesBarChart";
import { SalesSourceChart } from "@/components/sales/SalesSourceChart";
import { SalesBottleneckCard } from "@/components/sales/SalesBottleneckCard";
import { SalesInsightTable } from "@/components/sales/SalesInsightTable";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "meeting", label: "Meeting", color: "bg-purple-500" },
  { value: "proposal", label: "Proposal", color: "bg-orange-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-indigo-500" },
  { value: "won", label: "Won", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
];

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "event", label: "Event" },
  { value: "cold_call", label: "Cold Call" },
  { value: "other", label: "Other" },
];

type DateRangePreset = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "this_year" | "custom";
type CompareOption = "previous_period" | "custom" | "none";

export default function SalesDashboard() {
  const navigate = useNavigate();
  const [datePreset, setDatePreset] = useState<DateRangePreset>("this_month");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [compareOption, setCompareOption] = useState<CompareOption>("previous_period");
  const [compareRange, setCompareRange] = useState<{ from: Date; to: Date } | null>(null);
  const [salesFilter, setSalesFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calculate comparison period
  const comparisonRange = useMemo(() => {
    if (compareOption === "none") return null;
    if (compareOption === "custom" && compareRange) return compareRange;
    
    const daysDiff = differenceInDays(dateRange.to, dateRange.from);
    return {
      from: subMonths(dateRange.from, 1),
      to: subMonths(dateRange.to, 1),
    };
  }, [dateRange, compareOption, compareRange]);

  // Handle date preset changes
  const handleDatePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset);
    const now = new Date();
    
    switch (preset) {
      case "this_month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case "last_month":
        const lastMonth = subMonths(now, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case "last_3_months":
        setDateRange({ from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) });
        break;
      case "last_6_months":
        setDateRange({ from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) });
        break;
      case "this_year":
        setDateRange({ from: new Date(now.getFullYear(), 0, 1), to: now });
        break;
    }
  };

  // Check user roles for access control
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles-sales-dashboard"],
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

  const canAccessSales = userRoles?.includes('super_admin') || userRoles?.includes('marketing');

  // Fetch all prospects
  const { data: prospects, isLoading: prospectsLoading } = useQuery({
    queryKey: ["sales-dashboard-prospects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects" as any)
        .select(`
          *,
          pic:profiles!prospects_pic_id_fkey(id, full_name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: canAccessSales,
  });

  // Fetch status history for sales cycle calculation
  const { data: statusHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["sales-dashboard-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_status_history" as any)
        .select(`
          *,
          changed_by_profile:profiles!prospect_status_history_changed_by_fkey(id, full_name)
        `)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: canAccessSales,
  });

  // Fetch activity logs
  const { data: activityLogs } = useQuery({
    queryKey: ["sales-dashboard-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_activity_logs" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: canAccessSales,
  });

  // Fetch sales users (marketing role)
  const { data: salesUsers } = useQuery({
    queryKey: ["sales-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profile:profiles!user_roles_user_id_fkey(id, full_name)
        `)
        .in("role", ["marketing", "super_admin"]);
      if (error) throw error;
      return data as any[];
    },
    enabled: canAccessSales,
  });

  // Filter prospects by date range and filters
  const filteredProspects = useMemo(() => {
    if (!prospects) return [];
    
    return prospects.filter(p => {
      const createdAt = new Date(p.created_at);
      const inDateRange = createdAt >= dateRange.from && createdAt <= dateRange.to;
      const matchesSales = salesFilter === "all" || p.pic_id === salesFilter;
      const matchesSource = sourceFilter === "all" || p.source === sourceFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      
      return inDateRange && matchesSales && matchesSource && matchesStatus;
    });
  }, [prospects, dateRange, salesFilter, sourceFilter, statusFilter]);

  // Filter prospects for comparison period
  const comparisonProspects = useMemo(() => {
    if (!prospects || !comparisonRange) return [];
    
    return prospects.filter(p => {
      const createdAt = new Date(p.created_at);
      const inDateRange = createdAt >= comparisonRange.from && createdAt <= comparisonRange.to;
      const matchesSales = salesFilter === "all" || p.pic_id === salesFilter;
      const matchesSource = sourceFilter === "all" || p.source === sourceFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      
      return inDateRange && matchesSales && matchesSource && matchesStatus;
    });
  }, [prospects, comparisonRange, salesFilter, sourceFilter, statusFilter]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalProspects = filteredProspects.length;
    const dealsWon = filteredProspects.filter(p => p.status === "won").length;
    const dealsLost = filteredProspects.filter(p => p.status === "lost").length;
    const closingRate = totalProspects > 0 ? (dealsWon / (dealsWon + dealsLost)) * 100 : 0;
    
    // Calculate average sales cycle (days from new to won)
    let totalCycleDays = 0;
    let cycleCount = 0;
    
    filteredProspects.filter(p => p.status === "won").forEach(prospect => {
      const history = statusHistory?.filter(h => h.prospect_id === prospect.id) || [];
      const newEntry = history.find(h => h.old_status === "new" || history.indexOf(h) === 0);
      const wonEntry = history.find(h => h.new_status === "won");
      
      if (newEntry && wonEntry) {
        const days = differenceInDays(parseISO(wonEntry.created_at), parseISO(prospect.created_at));
        totalCycleDays += days;
        cycleCount++;
      }
    });
    
    const avgSalesCycle = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0;

    // Comparison calculations
    const compTotalProspects = comparisonProspects.length;
    const compDealsWon = comparisonProspects.filter(p => p.status === "won").length;
    const compDealsLost = comparisonProspects.filter(p => p.status === "lost").length;
    const compClosingRate = compTotalProspects > 0 ? (compDealsWon / (compDealsWon + compDealsLost)) * 100 : 0;
    
    return {
      closingRate: isNaN(closingRate) ? 0 : closingRate,
      dealsWon,
      totalProspects,
      avgSalesCycle,
      changes: {
        closingRate: closingRate - compClosingRate,
        dealsWon: dealsWon - compDealsWon,
        totalProspects: totalProspects - compTotalProspects,
        avgSalesCycle: 0, // Would need more complex calculation
      }
    };
  }, [filteredProspects, comparisonProspects, statusHistory]);

  // Redirect if no access
  if (!rolesLoading && !canAccessSales) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
            <Button className="mt-4" onClick={() => navigate("/")}>Go to Dashboard</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isLoading = prospectsLoading || historyLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sales Analytics</h1>
            <p className="text-muted-foreground">Track performance and analyze your sales pipeline</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/prospects")}>
            <Users className="h-4 w-4 mr-2" />
            View Prospects
          </Button>
        </div>

        {/* Global Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Period</label>
                <Select value={datePreset} onValueChange={(v) => handleDatePresetChange(v as DateRangePreset)}>
                  <SelectTrigger className="w-[180px]">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                    <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {datePreset === "custom" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Range</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[240px] justify-start">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {format(dateRange.from, "dd MMM yyyy", { locale: localeId })} - {format(dateRange.to, "dd MMM yyyy", { locale: localeId })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range) => {
                          if (range?.from && range?.to) {
                            setDateRange({ from: range.from, to: range.to });
                          }
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Compare With */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Compare with</label>
                <Select value={compareOption} onValueChange={(v) => setCompareOption(v as CompareOption)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="previous_period">Previous Period</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                    <SelectItem value="none">No Comparison</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sales Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sales</label>
                <Select value={salesFilter} onValueChange={setSalesFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Sales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sales</SelectItem>
                    {salesUsers?.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.profile?.full_name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Lead Source</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {SOURCE_OPTIONS.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Closing Rate"
            value={`${kpis.closingRate.toFixed(1)}%`}
            change={kpis.changes.closingRate}
            icon={Target}
            suffix="%"
            compareEnabled={compareOption !== "none"}
          />
          <KPICard
            title="Deals Won"
            value={kpis.dealsWon.toString()}
            change={kpis.changes.dealsWon}
            icon={Award}
            compareEnabled={compareOption !== "none"}
          />
          <KPICard
            title="Total New Prospects"
            value={kpis.totalProspects.toString()}
            change={kpis.changes.totalProspects}
            icon={Users}
            compareEnabled={compareOption !== "none"}
          />
          <KPICard
            title="Avg Sales Cycle"
            value={`${kpis.avgSalesCycle} days`}
            change={kpis.changes.avgSalesCycle}
            icon={Clock}
            invertChange
            compareEnabled={compareOption !== "none"}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesLineChart 
            title="Deals Won Per Month"
            prospects={prospects || []}
            statusHistory={statusHistory || []}
            dateRange={dateRange}
            metric="won"
          />
          <SalesLineChart 
            title="Closing Rate Per Month"
            prospects={prospects || []}
            statusHistory={statusHistory || []}
            dateRange={dateRange}
            metric="closing_rate"
          />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesFunnelChart 
            prospects={filteredProspects}
            statusOptions={STATUS_OPTIONS}
          />
          <SalesBarChart 
            title="Average Time Per Status"
            prospects={filteredProspects}
            activityLogs={activityLogs || []}
            statusHistory={statusHistory || []}
          />
        </div>

        {/* Charts Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesBarChart 
            title="Performance Per Sales"
            prospects={filteredProspects}
            activityLogs={activityLogs || []}
            statusHistory={statusHistory || []}
            type="sales_performance"
            salesUsers={salesUsers || []}
          />
          <SalesSourceChart 
            prospects={filteredProspects}
            sourceOptions={SOURCE_OPTIONS}
          />
        </div>

        {/* Bottleneck Visualization */}
        <SalesBottleneckCard 
          prospects={filteredProspects}
          activityLogs={activityLogs || []}
          statusHistory={statusHistory || []}
        />

        {/* Insight Table */}
        <SalesInsightTable 
          prospects={filteredProspects}
          activityLogs={activityLogs || []}
          statusHistory={statusHistory || []}
          onProspectClick={(id) => navigate(`/prospects?id=${id}`)}
        />
      </div>
    </AppLayout>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  suffix?: string;
  invertChange?: boolean;
  compareEnabled?: boolean;
}

function KPICard({ title, value, change, icon: Icon, suffix = "", invertChange = false, compareEnabled = true }: KPICardProps) {
  const isPositive = invertChange ? change <= 0 : change >= 0;
  const changeText = change === 0 ? "-" : `${change > 0 ? "+" : ""}${change.toFixed(1)}${suffix}`;
  
  return (
    <Card className="hover-lift">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {compareEnabled && change !== 0 && (
              <div className={cn(
                "flex items-center gap-1 mt-2 text-sm",
                isPositive ? "text-green-600" : "text-red-600"
              )}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{changeText} vs prev</span>
              </div>
            )}
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
