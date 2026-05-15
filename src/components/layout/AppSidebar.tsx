import { useState } from "react";
import { LogOut, Search, Command } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/hooks/usePermissions";
import { filterCategoriesByPermission, NavCategory } from "./nav-config";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canView } = usePermissions();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-sidebar"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.session.user.id)
        .maybeSingle();
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

  const categories = filterCategoriesByPermission(canView);

  const isCategoryActive = (cat: NavCategory) =>
    cat.items.some((i) => location.pathname === i.url || (i.url !== "/" && location.pathname.startsWith(i.url)));

  return (
    <aside className="hidden md:block w-[68px] shrink-0 self-stretch border-r border-sidebar-border/15 bg-sidebar relative z-30">
      <div
        className="sticky top-0 h-screen flex flex-col items-center w-full"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
      {/* Avatar */}
      <button
        onClick={() => navigate("/profile-settings")}
        className="h-10 w-10 rounded-xl bg-sidebar-primary/20 flex items-center justify-center mb-2 hover:bg-sidebar-primary/30 transition-colors"
        title={userProfile?.full_name || "Profile"}
      >
        <span className="text-sidebar-primary font-semibold text-sm">
          {userProfile?.full_name?.charAt(0)?.toUpperCase() || "U"}
        </span>
      </button>

      {/* Search trigger */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-tassa-search"))}
        title="Search (⌘K)"
        className="h-10 w-10 rounded-xl flex items-center justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mb-3"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {/* Category rail */}
      <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto py-1 w-full px-1 scrollbar-thin">
        {categories.map((cat) => {
          const active = isCategoryActive(cat);
          const Icon = cat.icon;
          return (
            <Popover
              key={cat.key}
              open={openKey === cat.key}
              onOpenChange={(o) => setOpenKey(o ? cat.key : null)}
            >
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-0.5 w-full py-2 rounded-xl transition-all",
                    active
                      ? "bg-sidebar-primary/15 text-sidebar-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.25)]"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  title={cat.label}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span className="text-[9.5px] font-medium tracking-wide leading-none">{cat.label}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={8}
                className="w-64 p-2 rounded-2xl border-border/40 shadow-soft-xl bg-popover/95 backdrop-blur-xl"
              >
                <div className="px-2 pt-1 pb-2 flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  <span className="text-[13px] font-semibold">{cat.label}</span>
                </div>
                <div className="flex flex-col">
                  {cat.items.map((it) => {
                    const ItemIcon = it.icon;
                    const isActive = location.pathname === it.url;
                    return (
                      <NavLink
                        key={it.url}
                        to={it.url}
                        onClick={() => setOpenKey(null)}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        <ItemIcon className="h-[15px] w-[15px] opacity-75 shrink-0" />
                        <span className="truncate">{it.title}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="h-10 w-10 rounded-xl flex items-center justify-center text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors mt-2 mb-3"
        title="Logout"
      >
        <LogOut className="h-[17px] w-[17px]" />
      </button>
      </div>
    </aside>
  );
}
