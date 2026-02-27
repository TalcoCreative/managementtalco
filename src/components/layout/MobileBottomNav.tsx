import { Home, CheckSquare, Briefcase, Calendar, BarChart3, Menu } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const primaryTabs = [
  { title: "Home", url: "/", icon: Home },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Projects", url: "/projects", icon: Briefcase },
  { title: "Schedule", url: "/schedule", icon: Calendar },
  { title: "More", url: "#more", icon: Menu },
];

const moreItems = [
  { title: "Clients", url: "/clients" },
  { title: "Client Hub", url: "/client-hub" },
  { title: "Shooting", url: "/shooting" },
  { title: "Meeting", url: "/meeting" },
  { title: "Leave", url: "/leave" },
  { title: "Reimburse", url: "/my-reimbursement" },
  { title: "Asset", url: "/asset" },
  { title: "Event", url: "/event" },
  { title: "Reports", url: "/reports" },
  { title: "Form Builder", url: "/forms" },
  { title: "KOL Database", url: "/kol-database" },
  { title: "KOL Campaign", url: "/kol-campaign" },
  { title: "Surat", url: "/letters" },
  { title: "Social Media", url: "/social-media" },
  { title: "Editorial Plan", url: "/editorial-plan" },
  { title: "Content Builder", url: "/content-builder" },
  { title: "Finance", url: "/finance" },
  { title: "HR Dashboard", url: "/hr-dashboard" },
  { title: "Recruitment", url: "/recruitment" },
  { title: "Sales", url: "/sales/dashboard" },
  { title: "Performance", url: "/performance" },
];

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/80 backdrop-blur-2xl border-t border-border/15"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16">
          {primaryTabs.map((tab) => {
            if (tab.url === "#more") {
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground/60 transition-all duration-200 tap-target",
                    moreOpen && "text-primary"
                  )}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium tracking-wide">{tab.title}</span>
                </button>
              );
            }
            const isActive = location.pathname === tab.url || (tab.url === "/" && location.pathname === "/");
            return (
              <NavLink
                key={tab.url}
                to={tab.url}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200 tap-target",
                  isActive ? "text-primary" : "text-muted-foreground/60"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200",
                  isActive && "bg-primary/10"
                )}>
                  <tab.icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-medium tracking-wide",
                  isActive && "font-semibold"
                )}>{tab.title}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10 max-h-[70vh] border-0 shadow-soft-xl">
          <SheetHeader>
            <SheetTitle className="text-base font-semibold">Menu Lainnya</SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 max-h-[55vh]">
            <div className="grid grid-cols-3 gap-2.5 pr-2">
              {moreItems.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center justify-center rounded-2xl px-3 py-3.5 text-xs font-medium transition-all duration-200 text-center tap-target",
                    location.pathname === item.url
                      ? "bg-primary/8 text-primary shadow-soft"
                      : "bg-muted/30 text-foreground hover:bg-muted/50 hover:shadow-soft"
                  )}
                >
                  {item.title}
                </NavLink>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
