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
  Megaphone
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const hrItems = [
  { title: "Team", url: "/users", icon: Users },
  { title: "HR Dashboard", url: "/hr-dashboard", icon: ClipboardCheck },
  { title: "Performance", url: "/performance", icon: TrendingUp },
  { title: "Recruitment", url: "/recruitment", icon: UserSearch },
];

const financeItems = [
  { title: "Finance", url: "/finance", icon: Wallet },
  { title: "Performance", url: "/performance", icon: TrendingUp },
];

const salesItems = [
  { title: "Prospects", url: "/prospects", icon: UserPlus },
  { title: "KOL Database", url: "/kol-database", icon: Star },
  { title: "KOL Campaign", url: "/kol-campaign", icon: Megaphone },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();

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

  const isHRorAdmin = userRoles?.includes('hr') || userRoles?.includes('super_admin');
  const canAccessFinance = userRoles?.includes('super_admin') || 
                           userRoles?.includes('finance') || 
                           userRoles?.includes('accounting') || 
                           userRoles?.includes('hr');
  const canAccessSales = userRoles?.includes('super_admin') || 
                         userRoles?.includes('hr') || 
                         userRoles?.includes('sales' as any) || 
                         userRoles?.includes('marketing');
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

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-6">
          {!isCollapsed && (
            <h1 className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
              Talco Management System
            </h1>
          )}
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={({ isActive }) => 
                        `flex items-center gap-3 ${isActive ? 'bg-sidebar-accent' : ''}`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {canAccessLetters && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/letters" 
                      className={({ isActive }) => 
                        `flex items-center gap-3 ${isActive ? 'bg-sidebar-accent' : ''}`
                      }
                    >
                      <FileText className="h-5 w-5" />
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
            <SidebarGroupLabel>HR</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {hrItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        className={({ isActive }) => 
                          `flex items-center gap-3 ${isActive ? 'bg-sidebar-accent' : ''}`
                        }
                      >
                        <item.icon className="h-5 w-5" />
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
            <SidebarGroupLabel>Finance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {financeItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        className={({ isActive }) => 
                          `flex items-center gap-3 ${isActive ? 'bg-sidebar-accent' : ''}`
                        }
                      >
                        <item.icon className="h-5 w-5" />
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
            <SidebarGroupLabel>Sales</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {salesItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url} 
                        className={({ isActive }) => 
                          `flex items-center gap-3 ${isActive ? 'bg-sidebar-accent' : ''}`
                        }
                      >
                        <item.icon className="h-5 w-5" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="w-full">
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
