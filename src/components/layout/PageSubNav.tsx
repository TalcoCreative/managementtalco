import { NavLink, useLocation } from "react-router-dom";
import { findCategoryByPath, filterCategoriesByPermission } from "./nav-config";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

/**
 * Auto-rendered sub-navigation chip-tabs based on the active sidebar category.
 * Mounted globally in AppLayout so every page gets sibling-route tabs without
 * needing per-page changes. Hidden when the category has 0 or 1 visible items.
 */
export function PageSubNav() {
  const { pathname } = useLocation();
  const { canView } = usePermissions();

  const rawCat = findCategoryByPath(pathname);
  if (!rawCat) return null;

  // Apply permission filter
  const visible = filterCategoriesByPermission(canView).find((c) => c.key === rawCat.key);
  if (!visible || visible.items.length < 2) return null;

  return (
    <div
      className="page-subnav -mx-4 sm:mx-0 px-4 sm:px-0 mb-4 sm:mb-5"
      style={{ ["--cat-color" as any]: visible.color }}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1">
        {visible.items.map((it) => {
          const Icon = it.icon;
          const active =
            pathname === it.url ||
            (it.url !== "/" && pathname.startsWith(it.url + "/"));
          return (
            <NavLink
              key={it.url}
              to={it.url}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-medium transition-all whitespace-nowrap border",
                active
                  ? "text-white border-transparent shadow-sm"
                  : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              )}
              style={
                active
                  ? { background: visible.color, boxShadow: `0 6px 16px -6px ${visible.color}` }
                  : undefined
              }
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{it.title}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
