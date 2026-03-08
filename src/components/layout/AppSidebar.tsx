import { 
  Users, Briefcase, CheckSquare, Calendar, BarChart3, Building2, ClipboardCheck,
  Video, Home, LogOut, CalendarOff, Wallet, Receipt, UserPlus, TrendingUp,
  UserSearch, CalendarClock, Package, FileText, Star, Megaphone, PartyPopper,
  Crown, Share2, Mail, Scale, PieChart, Sparkles, CalendarHeart, BarChart2, Shield, Settings,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/usePermissions";

type NavItem = { title: string; url: string; icon: any; featureKey: string };

// ── Main ────────────────────────────────────────────────
const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: Home, featureKey: "dashboard" },
  { title: "Clients", url: "/clients", icon: Building2, featureKey: "clients" },
  { title: "Projects", url: "/projects", icon: Briefcase, featureKey: "projects" },
  { title: "Tasks", url: "/tasks", icon: CheckSquare, featureKey: "tasks" },
  { title: "Schedule", url: "/schedule", icon: Calendar, featureKey: "schedule" },
];

// ── Operations ──────────────────────────────────────────
const operationsItems: NavItem[] = [
  { title: "Shooting", url: "/shooting", icon: Video, featureKey: "shooting" },
  { title: "Meeting", url: "/meeting", icon: CalendarClock, featureKey: "meeting" },
  { title: "Event", url: "/event", icon: PartyPopper, featureKey: "event" },
];

// ── Employee ────────────────────────────────────────────
const employeeItems: NavItem[] = [
  { title: "Leave", url: "/leave", icon: CalendarOff, featureKey: "leave" },
  { title: "Reimburse", url: "/my-reimbursement", icon: Receipt, featureKey: "reimburse" },
  { title: "Asset", url: "/asset", icon: Package, featureKey: "asset" },
];

// ── Reports & Letters ───────────────────────────────────
const reportsItems: NavItem[] = [
  { title: "Reports", url: "/reports", icon: BarChart3, featureKey: "reports" },
  { title: "Letters", url: "/letters", icon: FileText, featureKey: "letters" },
];

// ── KOL ─────────────────────────────────────────────────
const kolItems: NavItem[] = [
  { title: "KOL Database", url: "/kol-database", icon: Star, featureKey: "kol_database" },
  { title: "KOL Campaign", url: "/kol-campaign", icon: Megaphone, featureKey: "kol_campaign" },
];

// ── Form Builder ────────────────────────────────────────
const formBuilderItems: NavItem[] = [
  { title: "Form Builder", url: "/forms", icon: FileText, featureKey: "form_builder" },
];

// ── Social Media ────────────────────────────────────────
const socialMediaItems: NavItem[] = [
  { title: "Social Media", url: "/social-media", icon: Share2, featureKey: "social_media" },
  { title: "Editorial Plan", url: "/editorial-plan", icon: FileText, featureKey: "editorial_plan" },
  { title: "Content Builder", url: "/content-builder", icon: Sparkles, featureKey: "content_builder" },
];

// ── HR ──────────────────────────────────────────────────
const hrItems: NavItem[] = [
  { title: "Team", url: "/users", icon: Users, featureKey: "team" },
  { title: "HR Dashboard", url: "/hr-dashboard", icon: ClipboardCheck, featureKey: "hr_dashboard" },
  { title: "HR Analytics", url: "/hr/analytics", icon: BarChart2, featureKey: "hr_analytics" },
  { title: "Holiday Calendar", url: "/hr/holiday", icon: CalendarHeart, featureKey: "holiday_calendar" },
  { title: "Performance", url: "/performance", icon: TrendingUp, featureKey: "performance" },
  { title: "Recruitment", url: "/recruitment", icon: UserSearch, featureKey: "recruitment" },
  { title: "Recruitment Dashboard", url: "/recruitment/dashboard", icon: BarChart3, featureKey: "recruitment_dashboard" },
  { title: "Recruitment Forms", url: "/recruitment/forms", icon: FileText, featureKey: "recruitment_forms" },
];

// ── Finance ─────────────────────────────────────────────
const financeItems: NavItem[] = [
  { title: "Finance", url: "/finance", icon: Wallet, featureKey: "finance" },
  { title: "Laba Rugi", url: "/finance/laporan-laba-rugi", icon: PieChart, featureKey: "income_statement" },
  { title: "Neraca", url: "/finance/neraca", icon: Scale, featureKey: "balance_sheet" },
];

// ── Sales ───────────────────────────────────────────────
const salesItems: NavItem[] = [
  { title: "Sales Analytics", url: "/sales/dashboard", icon: TrendingUp, featureKey: "sales_analytics" },
  { title: "Prospects", url: "/prospects", icon: UserPlus, featureKey: "prospects" },
];

// ── Executive ───────────────────────────────────────────
const executiveItems: NavItem[] = [
  { title: "CEO Dashboard", url: "/ceo-dashboard", icon: Crown, featureKey: "ceo_dashboard" },
];

// ── System ──────────────────────────────────────────────
const systemItems: NavItem[] = [
  { title: "Email Settings", url: "/system/email-settings", icon: Mail, featureKey: "email_settings" },
  { title: "Role & Access", url: "/system/roles", icon: Shield, featureKey: "role_management" },
  { title: "System Settings", url: "/system/settings", icon: Settings, featureKey: "system_settings" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const { canView, isSuperAdmin } = usePermissions();

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-sidebar"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch {
      toast.error("Failed to log out");
    }
  };

  const isCollapsed = state === "collapsed";

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-sidebar-primary/15 text-sidebar-primary-foreground shadow-inner-soft'
        : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
    }`;

  const filterItems = (items: NavItem[]) => items.filter(i => canView(i.featureKey));

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = filterItems(items);
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-sidebar-foreground/30 text-[10px] font-semibold uppercase tracking-[0.1em] px-4 mb-1.5">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="px-2 space-y-0.5">
            {visible.map((item) => (
              <SidebarMenuItem key={item.title + item.url}>
                <SidebarMenuButton asChild>
                  <NavLink to={item.url} className={navLinkClass}>
                    <item.icon className="h-4 w-4 opacity-70" />
                    {!isCollapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/15">
      <SidebarContent className="bg-sidebar">
        <div className="px-4 py-6">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-sidebar-primary/20 flex items-center justify-center">
                <span className="text-sidebar-primary font-semibold text-sm">
                  {userProfile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <h1 className="text-sm font-semibold text-sidebar-foreground leading-tight">
                  Hi, {userProfile?.full_name?.split(" ")[0] || "User"}
                </h1>
                <p className="text-[10px] text-sidebar-foreground/40 mt-0.5">Talco Management</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="h-9 w-9 rounded-xl bg-sidebar-primary/20 flex items-center justify-center">
                <span className="text-sidebar-primary font-semibold text-sm">
                  {userProfile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {renderGroup("Main", mainItems)}
        {renderGroup("Operations", operationsItems)}
        {renderGroup("Employee", employeeItems)}
        {renderGroup("Reports & Letters", reportsItems)}
        {renderGroup("KOL", kolItems)}
        {renderGroup("Form Builder", formBuilderItems)}
        {renderGroup("Social Media", socialMediaItems)}
        {renderGroup("HR", hrItems)}
        {renderGroup("Finance", financeItems)}
        {renderGroup("Sales", salesItems)}
        {renderGroup("Executive", executiveItems)}
        {renderGroup("System", systemItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/15 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout} 
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/50 hover:bg-destructive/8 hover:text-destructive transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
