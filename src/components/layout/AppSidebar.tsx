import { 
  Users, 
  Briefcase, 
  CheckSquare, 
  Calendar, 
  BarChart3,
  Building2,
  ClipboardCheck,
  Video,
  Home,
  LogOut,
  CalendarOff,
  Wallet,
  Receipt,
  UserPlus,
  TrendingUp,
  UserSearch,
  CalendarClock,
  Package,
  FileText,
  Star,
  Megaphone,
  PartyPopper,
  Crown,
  Share2,
  Mail,
  Scale,
  PieChart,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Projects", url: "/projects", icon: Briefcase },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Schedule", url: "/schedule", icon: Calendar },
  { title: "Shooting", url: "/shooting", icon: Video },
  { title: "Meeting", url: "/meeting", icon: CalendarClock },
  { title: "Leave", url: "/leave", icon: CalendarOff },
  { title: "Reimburse", url: "/my-reimbursement", icon: Receipt },
  { title: "Asset", url: "/asset", icon: Package },
  { title: "Event", url: "/event", icon: PartyPopper },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "KOL Database", url: "/kol-database", icon: Star },
  { title: "KOL Campaign", url: "/kol-campaign", icon: Megaphone },
  { title: "Social Media", url: "/social-media", icon: Share2 },
];

import { BarChart2 } from "lucide-react";

const hrItems = [
  { title: "Team", url: "/users", icon: Users },
  { title: "HR Dashboard", url: "/hr-dashboard", icon: ClipboardCheck },
  { title: "HR Analytics", url: "/hr/analytics", icon: BarChart2 },
  { title: "Performance", url: "/performance", icon: TrendingUp },
  { title: "Recruitment", url: "/recruitment", icon: UserSearch },
  { title: "Recruitment Dashboard", url: "/recruitment/dashboard", icon: BarChart3 },
  { title: "Form Builder", url: "/recruitment/forms", icon: FileText },
];

const financeItems = [
  { title: "Finance", url: "/finance", icon: Wallet },
  { title: "Laba Rugi", url: "/finance/laporan-laba-rugi", icon: PieChart },
  { title: "Neraca", url: "/finance/neraca", icon: Scale },
  { title: "Performance", url: "/performance", icon: TrendingUp },
];

const salesItems = [
  { title: "Sales Analytics", url: "/sales/dashboard", icon: TrendingUp },
  { title: "Prospects", url: "/prospects", icon: UserPlus },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();

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

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
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

  const isSuperAdmin = userRoles?.includes('super_admin');
  const isHRorAdmin = userRoles?.includes('hr') || userRoles?.includes('super_admin');
  const canAccessFinance = userRoles?.includes('super_admin') || 
                           userRoles?.includes('finance') || 
                           userRoles?.includes('accounting') || 
                           userRoles?.includes('hr');
  const canAccessSales = userRoles?.includes('super_admin') || userRoles?.includes('marketing');
  const canAccessLetters = userRoles?.includes('super_admin') || 
                           userRoles?.includes('hr') || 
                           userRoles?.includes('finance') || 
                           userRoles?.includes('project_manager') || 
                           userRoles?.includes('sales' as any);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  const isCollapsed = state === "collapsed";

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
    }`;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/30">
      <SidebarContent className="bg-sidebar">
        <div className="px-4 py-5">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <span className="text-sidebar-primary-foreground font-semibold text-sm">
                  {userProfile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <h1 className="text-sm font-semibold text-sidebar-foreground">
                Hi, {userProfile?.full_name?.split(" ")[0] || "User"}
              </h1>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <span className="text-sidebar-primary-foreground font-semibold text-sm">
                  {userProfile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
            </div>
          )}
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] font-semibold uppercase tracking-wider px-4 mb-1">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-0.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={navLinkClass}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {canAccessLetters && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/letters" className={navLinkClass}>
                      <FileText className="h-4 w-4" />
                      {!isCollapsed && <span>Surat</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isHRorAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] font-semibold uppercase tracking-wider px-4 mb-1">
              HR
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-2 space-y-0.5">
                {hrItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={navLinkClass}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {canAccessFinance && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] font-semibold uppercase tracking-wider px-4 mb-1">
              Finance
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-2 space-y-0.5">
                {financeItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={navLinkClass}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {canAccessSales && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] font-semibold uppercase tracking-wider px-4 mb-1">
              Sales
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-2 space-y-0.5">
                {salesItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={navLinkClass}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] font-semibold uppercase tracking-wider px-4 mb-1">
              Executive
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-2 space-y-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/ceo-dashboard" className={navLinkClass}>
                      <Crown className="h-4 w-4" />
                      {!isCollapsed && <span>CEO Dashboard</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] font-semibold uppercase tracking-wider px-4 mb-1">
              System
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="px-2 space-y-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/system/email-settings" className={navLinkClass}>
                      <Mail className="h-4 w-4" />
                      {!isCollapsed && <span>Email Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/30 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout} 
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors duration-150"
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