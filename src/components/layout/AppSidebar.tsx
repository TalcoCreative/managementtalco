import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Search } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { filterCategoriesByPermission, NavCategory } from "./nav-config";
import { useChatUnread } from "@/hooks/useChatUnread";

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
  const { data: currentUser } = useQuery({
    queryKey: ["chat-sidebar-current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ?? null;
    },
  });
  const { total: unreadChats } = useChatUnread(currentUser?.id);

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

  // Auto-open the active category on first render
  if (openKey === null) {
    const active = categories.find(isCategoryActive);
    if (active && active.items.length > 1) {
      // defer to avoid setState during render
      setTimeout(() => setOpenKey((k) => (k === null ? active.key : k)), 0);
    }
  }

  return (
    <aside className="hidden md:block w-[232px] shrink-0 self-stretch border-r border-sidebar-border/15 bg-sidebar relative z-30">
      <div
        className="sticky top-0 h-screen flex flex-col w-full"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        {/* Profile + Search row */}
        <div className="flex items-center gap-2 px-3 mb-3">
          <button
            onClick={() => navigate("/profile-settings")}
            className="h-10 w-10 rounded-xl bg-sidebar-primary/20 flex items-center justify-center hover:bg-sidebar-primary/30 transition-colors shrink-0"
            title={userProfile?.full_name || "Profile"}
          >
            <span className="text-sidebar-primary font-semibold text-sm">
              {userProfile?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-sidebar-foreground/60 leading-none">Hi,</p>
            <p className="text-[13px] font-semibold text-sidebar-foreground truncate">
              {userProfile?.full_name?.split(" ")[0] || "User"}
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-tassa-search"))}
            title="Search (⌘K)"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors shrink-0"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Inline accordion nav */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-thin">
          {categories.map((cat) => {
            const active = isCategoryActive(cat);
            const isOpen = openKey === cat.key;
            const Icon = cat.icon;
            const hasMultiple = cat.items.length > 1;
            const isChatCategory = cat.key === "chat";
            const chatBadge = isChatCategory ? unreadChats : 0;

            const headerClass = cn(
              "group flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all text-left",
              active
                ? "bg-sidebar-primary/15 text-sidebar-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            );

            const handleClick = () => {
              if (hasMultiple) {
                setOpenKey(isOpen ? null : cat.key);
              } else {
                navigate(cat.items[0].url);
              }
            };

            return (
              <div key={cat.key}>
                <button onClick={handleClick} className={headerClass} title={cat.label}>
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: active ? `${cat.color}30` : `${cat.color}1a` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  <span className="flex-1 text-[13px] font-medium truncate">{cat.label}</span>
                  {chatBadge > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shrink-0">
                      {chatBadge > 99 ? "99+" : chatBadge}
                    </span>
                  )}
                  {hasMultiple && (
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 opacity-60 transition-transform shrink-0",
                        isOpen && "rotate-180"
                      )}
                    />
                  )}
                </button>

                {hasMultiple && isOpen && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border/30 space-y-0.5 py-1">
                    {cat.items.map((it) => {
                      const ItemIcon = it.icon;
                      const itemActive = location.pathname === it.url;
                      return (
                        <NavLink
                          key={it.url}
                          to={it.url}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] font-medium transition-colors",
                            itemActive
                              ? "bg-sidebar-primary/15 text-sidebar-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                          )}
                        >
                          <ItemIcon className="h-3.5 w-3.5 opacity-75 shrink-0" />
                          <span className="truncate">{it.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mx-2 mb-3 flex items-center gap-2 px-2.5 py-2 rounded-lg text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Logout"
        >
          <div className="h-7 w-7 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <LogOut className="h-3.5 w-3.5" />
          </div>
          <span className="text-[13px] font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
