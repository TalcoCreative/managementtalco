import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Home, LayoutDashboard, BarChart3, Camera, FileText,
  Users, Video, Menu, ShoppingBag, Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface HubNavItem {
  title: string;
  icon: React.ElementType;
  gradient: string;
  pathPrefix: string;
  getPath: () => string;
  enabled: boolean;
}

interface HubBottomNavProps {
  clientName: string;
  clientSlug: string;
  dashboardSlug: string | null;
  socialMediaSlug: string | null;
  availableFeatures: {
    hasProjects: boolean;
    hasReports: boolean;
    hasSocialMedia: boolean;
    hasEditorialPlans: boolean;
    hasMeetings: boolean;
    hasShootings: boolean;
    hasMarketplace?: boolean;
    hasKolCampaigns?: boolean;
  };
}

export function HubBottomNav({
  clientName,
  clientSlug,
  dashboardSlug,
  socialMediaSlug,
  availableFeatures,
}: HubBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const allFeatures: HubNavItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      gradient: "from-[hsl(222,72%,52%)] to-[hsl(222,60%,62%)]",
      pathPrefix: "/dashboard/",
      getPath: () => `/dashboard/${dashboardSlug}`,
      enabled: availableFeatures.hasProjects && !!dashboardSlug,
    },
    {
      title: "Reports",
      icon: BarChart3,
      gradient: "from-[hsl(152,48%,46%)] to-[hsl(152,48%,56%)]",
      pathPrefix: "/reports/",
      getPath: () => `/reports/${dashboardSlug}`,
      enabled: availableFeatures.hasReports && !!dashboardSlug,
    },
    {
      title: "Social Media",
      icon: Camera,
      gradient: "from-[hsl(28,78%,52%)] to-[hsl(38,82%,52%)]",
      pathPrefix: "/social-media/client/",
      getPath: () => `/social-media/client/${socialMediaSlug}`,
      enabled: availableFeatures.hasSocialMedia && !!socialMediaSlug,
    },
    {
      title: "Editorial",
      icon: FileText,
      gradient: "from-[hsl(270,60%,55%)] to-[hsl(280,50%,65%)]",
      pathPrefix: "/ep-list/",
      getPath: () => `/ep-list/${dashboardSlug}`,
      enabled: availableFeatures.hasEditorialPlans && !!dashboardSlug,
    },
    {
      title: "Meeting",
      icon: Users,
      gradient: "from-[hsl(240,60%,58%)] to-[hsl(250,50%,68%)]",
      pathPrefix: "/meeting-list/",
      getPath: () => `/meeting-list/${dashboardSlug}`,
      enabled: availableFeatures.hasMeetings && !!dashboardSlug,
    },
    {
      title: "Shooting",
      icon: Video,
      gradient: "from-[hsl(330,60%,55%)] to-[hsl(340,50%,65%)]",
      pathPrefix: "/shooting-list/",
      getPath: () => `/shooting-list/${dashboardSlug}`,
      enabled: availableFeatures.hasShootings && !!dashboardSlug,
    },
    {
      title: "Marketplace",
      icon: ShoppingBag,
      gradient: "from-[hsl(152,48%,46%)] to-[hsl(140,60%,45%)]",
      pathPrefix: "/marketplace/",
      getPath: () => `/marketplace/${dashboardSlug}`,
      enabled: !!availableFeatures.hasMarketplace && !!dashboardSlug,
    },
    {
      title: "KOL",
      icon: Megaphone,
      gradient: "from-[hsl(28,78%,52%)] to-[hsl(18,72%,48%)]",
      pathPrefix: "/kol-campaign/",
      getPath: () => `/kol-campaign/${dashboardSlug}`,
      enabled: !!availableFeatures.hasKolCampaigns && !!dashboardSlug,
    },
  ];

  const available = allFeatures.filter((f) => f.enabled);
  const isHubHome = location.pathname.startsWith(`/hub/`);

  // Show up to 2 primary items in the bar + Hub + Back + More
  const primaryItems = available.slice(0, 2);
  const hasMore = available.length > 2;

  const isActive = (item: HubNavItem) => location.pathname.startsWith(item.pathPrefix);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-2xl border-t border-border/30"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-wide">Back</span>
          </button>

          {/* Home (Hub) */}
          <button
            onClick={() => navigate(`/hub/${clientSlug}`)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200 active:scale-95",
              isHubHome ? "text-primary" : "text-muted-foreground"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200",
              isHubHome && "bg-primary/10"
            )}>
              <Home className="h-5 w-5" />
            </div>
            <span className={cn(
              "text-[10px] font-medium tracking-wide",
              isHubHome && "font-semibold"
            )}>Hub</span>
          </button>

          {/* Primary feature shortcuts */}
          {primaryItems.map((item) => {
            const active = isActive(item);
            return (
              <button
                key={item.title}
                onClick={() => navigate(item.getPath())}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200 active:scale-95",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200",
                  active && "bg-primary/10"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-medium tracking-wide truncate max-w-[56px]",
                  active && "font-semibold"
                )}>
                  {item.title}
                </span>
              </button>
            );
          })}

          {/* More */}
          {hasMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground transition-all duration-200 active:scale-95",
                moreOpen && "text-primary"
              )}
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium tracking-wide">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl pb-10 max-h-[70vh] border-0 shadow-soft-xl bg-background flex flex-col"
        >
          <SheetHeader className="shrink-0">
            <SheetTitle className="text-base font-semibold">
              {clientName} — Semua Fitur
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid grid-cols-3 gap-3 pb-4">
              {available.map((item) => {
                const active = isActive(item);
                return (
                  <button
                    key={item.title}
                    onClick={() => { navigate(item.getPath()); setMoreOpen(false); }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200 hover:bg-muted/50 active:scale-[0.96]",
                      active && "bg-primary/8"
                    )}
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg`}
                    >
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium text-foreground text-center leading-tight line-clamp-2",
                      active && "text-primary font-semibold"
                    )}>
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
