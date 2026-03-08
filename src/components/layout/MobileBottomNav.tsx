import {
  Home, CheckSquare, Briefcase, Calendar, Menu, Users, Camera, Video,
  CalendarOff, Receipt, Package, PartyPopper, BarChart3, FileText, Megaphone,
  Palette, Hammer, UserCog, LayoutDashboard, TrendingUp, DollarSign, Settings,
  Mail, Shield, Wrench, Target, Search, Building2, PieChart, GraduationCap,
  Star, Sparkles, Share2, CalendarHeart, Crown, Scale, UserPlus, CalendarClock,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePermissions } from "@/hooks/usePermissions";

const primaryTabs = [
  { title: "Home", url: "/", icon: Home, featureKey: "dashboard" },
  { title: "Tasks", url: "/tasks", icon: CheckSquare, featureKey: "tasks" },
  { title: "Projects", url: "/projects", icon: Briefcase, featureKey: "projects" },
  { title: "Schedule", url: "/schedule", icon: Calendar, featureKey: "schedule" },
  { title: "More", url: "#more", icon: Menu, featureKey: "__more__" },
];

interface MoreItem {
  title: string;
  url: string;
  featureKey: string;
  icon: any;
  color: string;
}

interface MoreGroup {
  label: string;
  items: MoreItem[];
}

const moreGroups: MoreGroup[] = [
  {
    label: "Operations",
    items: [
      { title: "Shooting", url: "/shooting", featureKey: "shooting", icon: Camera, color: "hsl(152,48%,46%)" },
      { title: "Meeting", url: "/meeting", featureKey: "meeting", icon: CalendarClock, color: "hsl(280,60%,55%)" },
      { title: "Event", url: "/event", featureKey: "event", icon: PartyPopper, color: "hsl(330,60%,55%)" },
    ],
  },
  {
    label: "Employee",
    items: [
      { title: "Leave", url: "/leave", featureKey: "leave", icon: CalendarOff, color: "hsl(38,82%,52%)" },
      { title: "Reimburse", url: "/my-reimbursement", featureKey: "reimburse", icon: Receipt, color: "hsl(152,48%,46%)" },
      { title: "Asset", url: "/asset", featureKey: "asset", icon: Package, color: "hsl(222,72%,52%)" },
    ],
  },
  {
    label: "Reports & Letters",
    items: [
      { title: "Reports", url: "/reports", featureKey: "reports", icon: BarChart3, color: "hsl(205,72%,52%)" },
      { title: "Surat", url: "/letters", featureKey: "letters", icon: FileText, color: "hsl(38,82%,52%)" },
    ],
  },
  {
    label: "KOL",
    items: [
      { title: "KOL Database", url: "/kol-database", featureKey: "kol_database", icon: Star, color: "hsl(38,82%,52%)" },
      { title: "KOL Campaign", url: "/kol-campaign", featureKey: "kol_campaign", icon: Megaphone, color: "hsl(0,62%,54%)" },
    ],
  },
  {
    label: "Form Builder",
    items: [
      { title: "Form Builder", url: "/forms", featureKey: "form_builder", icon: FileText, color: "hsl(280,60%,55%)" },
    ],
  },
  {
    label: "Social Media",
    items: [
      { title: "Social Media", url: "/social-media", featureKey: "social_media", icon: Share2, color: "hsl(330,60%,55%)" },
      { title: "Editorial Plan", url: "/editorial-plan", featureKey: "editorial_plan", icon: Palette, color: "hsl(280,60%,55%)" },
      { title: "Content Builder", url: "/content-builder", featureKey: "content_builder", icon: Sparkles, color: "hsl(222,72%,52%)" },
    ],
  },
  {
    label: "HR",
    items: [
      { title: "Team", url: "/users", featureKey: "team", icon: UserCog, color: "hsl(205,72%,52%)" },
      { title: "HR Dashboard", url: "/hr-dashboard", featureKey: "hr_dashboard", icon: LayoutDashboard, color: "hsl(280,60%,55%)" },
      { title: "HR Analytics", url: "/hr/analytics", featureKey: "hr_analytics", icon: PieChart, color: "hsl(330,60%,55%)" },
      { title: "Kalender Libur", url: "/hr/holiday", featureKey: "holiday_calendar", icon: CalendarHeart, color: "hsl(38,82%,52%)" },
      { title: "Performance", url: "/performance", featureKey: "performance", icon: TrendingUp, color: "hsl(152,48%,46%)" },
      { title: "Recruitment", url: "/recruitment", featureKey: "recruitment", icon: GraduationCap, color: "hsl(152,48%,46%)" },
      { title: "Rekrut Dashboard", url: "/recruitment/dashboard", featureKey: "recruitment_dashboard", icon: BarChart3, color: "hsl(222,72%,52%)" },
      { title: "Rekrut Forms", url: "/recruitment/forms", featureKey: "recruitment_forms", icon: FileText, color: "hsl(205,72%,52%)" },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Finance", url: "/finance", featureKey: "finance", icon: DollarSign, color: "hsl(152,48%,46%)" },
      { title: "Laba Rugi", url: "/finance/laporan-laba-rugi", featureKey: "income_statement", icon: TrendingUp, color: "hsl(38,82%,52%)" },
      { title: "Neraca", url: "/finance/neraca", featureKey: "balance_sheet", icon: Scale, color: "hsl(222,72%,52%)" },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Sales Analytics", url: "/sales/dashboard", featureKey: "sales_analytics", icon: BarChart3, color: "hsl(205,72%,52%)" },
      { title: "Prospects", url: "/prospects", featureKey: "prospects", icon: UserPlus, color: "hsl(330,60%,55%)" },
    ],
  },
  {
    label: "Executive",
    items: [
      { title: "CEO Dashboard", url: "/ceo-dashboard", featureKey: "ceo_dashboard", icon: Crown, color: "hsl(0,62%,54%)" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Email Settings", url: "/system/email-settings", featureKey: "email_settings", icon: Mail, color: "hsl(222,10%,48%)" },
      { title: "Role & Access", url: "/system/roles", featureKey: "role_management", icon: Shield, color: "hsl(152,48%,46%)" },
      { title: "System Settings", url: "/system/settings", featureKey: "system_settings", icon: Settings, color: "hsl(222,10%,48%)" },
    ],
  },
];

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { canView } = usePermissions();

  const visiblePrimary = primaryTabs.filter(
    (t) => t.featureKey === "__more__" || canView(t.featureKey)
  );

  const visibleGroups = moreGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => canView(i.featureKey)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-2xl border-t border-border/30"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16">
          {visiblePrimary.map((tab) => {
            if (tab.url === "#more") {
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground transition-all duration-200 tap-target",
                    moreOpen && "text-primary"
                  )}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium tracking-wide">
                    {tab.title}
                  </span>
                </button>
              );
            }
            const isActive =
              location.pathname === tab.url ||
              (tab.url === "/" && location.pathname === "/");
            return (
              <NavLink
                key={tab.url}
                to={tab.url}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200 tap-target",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200",
                    isActive && "bg-primary/10"
                  )}
                >
                  <tab.icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium tracking-wide",
                    isActive && "font-semibold"
                  )}
                >
                  {tab.title}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl pb-10 max-h-[80vh] border-0 shadow-soft-xl bg-background"
        >
          <SheetHeader>
            <SheetTitle className="text-base font-semibold">
              All Modules
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-3 max-h-[65vh]">
            <div className="space-y-5 pr-2 pb-4">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all duration-200 tap-target active:scale-[0.96]",
                            isActive
                              ? "bg-primary/8 shadow-sm"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div
                            className="flex items-center justify-center w-10 h-10 rounded-xl"
                            style={{
                              backgroundColor: `${item.color}15`,
                            }}
                          >
                            <item.icon
                              className="h-5 w-5"
                              style={{ color: item.color }}
                            />
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-medium leading-tight text-center",
                              isActive
                                ? "text-primary"
                                : "text-foreground/80"
                            )}
                          >
                            {item.title}
                          </span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
