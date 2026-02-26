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
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-card/95 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around h-14">
          {primaryTabs.map((tab) => {
            if (tab.url === "#more") {
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 w-full h-full text-muted-foreground transition-colors",
                    moreOpen && "text-primary"
                  )}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{tab.title}</span>
                </button>
              );
            }
            const isActive = location.pathname === tab.url || (tab.url === "/" && location.pathname === "/");
            return (
              <NavLink
                key={tab.url}
                to={tab.url}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.title}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8 max-h-[70vh]">
          <SheetHeader>
            <SheetTitle className="text-base">Menu Lainnya</SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-3 max-h-[55vh]">
            <div className="grid grid-cols-3 gap-2 pr-2">
              {moreItems.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center justify-center rounded-xl px-2 py-3 text-xs font-medium transition-colors text-center",
                    location.pathname === item.url
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/50 text-foreground hover:bg-muted"
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
