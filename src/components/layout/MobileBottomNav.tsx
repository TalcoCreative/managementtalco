import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/usePermissions";
import { filterCategoriesByPermission, NavCategory } from "./nav-config";

export function MobileBottomNav() {
  const [openCat, setOpenCat] = useState<NavCategory | null>(null);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { canView } = usePermissions();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) < 8) return;
      if (y > lastY.current && y > 80) setHidden(true);
      else setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const categories = filterCategoriesByPermission(canView);

  // Show first 4 categories + Search button
  const primaryCats = categories.slice(0, 4);
  const remainingCats = categories.slice(4);

  const isCategoryActive = (cat: NavCategory) =>
    cat.items.some((i) => location.pathname === i.url || (i.url !== "/" && location.pathname.startsWith(i.url)));

  return (
    <>
      <nav className="floating-nav-pill md:hidden" data-hidden={hidden} aria-label="Primary">
        <div className="flex items-center justify-around h-14 px-2">
          {primaryCats.map((cat) => {
            const Icon = cat.icon;
            const active = isCategoryActive(cat);
            return (
              <button
                key={cat.key}
                onClick={() => {
                  // Single-item categories navigate directly; otherwise open sheet
                  if (cat.items.length === 1) navigate(cat.items[0].url);
                  else setOpenCat(cat);
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all tap-target rounded-full",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-label={cat.label}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-9 h-7 rounded-full transition-all duration-300",
                    active && "bg-primary/10 shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <span className={cn("text-[9.5px] font-medium tracking-wide", active && "font-semibold")}>
                  {cat.label}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-tassa-search"))}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-all tap-target rounded-full"
            aria-label="Search"
          >
            <div className="flex items-center justify-center w-9 h-7 rounded-full">
              <Search className="h-[18px] w-[18px]" />
            </div>
            <span className="text-[9.5px] font-medium tracking-wide">Search</span>
          </button>
        </div>
      </nav>

      {/* Bottom sheet listing this category's features */}
      <Sheet open={!!openCat} onOpenChange={(o) => !o && setOpenCat(null)}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl pb-10 max-h-[85vh] border-0 shadow-soft-xl bg-background flex flex-col"
        >
          <SheetHeader className="shrink-0">
            <SheetTitle className="text-base font-semibold flex items-center gap-2">
              {openCat && (
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${openCat.color}20` }}
                >
                  <openCat.icon className="h-4 w-4" style={{ color: openCat.color }} />
                </div>
              )}
              {openCat?.label}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 flex-1 overflow-y-auto overscroll-contain -mx-1 px-1">
            <div className="grid grid-cols-3 min-[360px]:grid-cols-4 gap-2 pr-2 pb-4">
              {openCat?.items.map((item) => {
                const ItemIcon = item.icon;
                const isActive = location.pathname === item.url;
                return (
                  <button
                    key={item.url}
                    onClick={() => {
                      navigate(item.url);
                      setOpenCat(null);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all tap-target active:scale-[0.96]",
                      isActive ? "bg-primary/8 shadow-sm" : "hover:bg-muted/50"
                    )}
                  >
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-xl"
                      style={{ backgroundColor: `${openCat!.color}15` }}
                    >
                      <ItemIcon className="h-5 w-5" style={{ color: openCat!.color }} />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium leading-tight text-center text-foreground line-clamp-2 max-w-[64px]",
                        isActive && "text-primary"
                      )}
                    >
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Other categories quick access */}
            {remainingCats.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/40">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  More categories
                </p>
                <div className="grid grid-cols-3 min-[360px]:grid-cols-4 gap-2 pb-4">
                  {remainingCats.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setOpenCat(cat)}
                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl hover:bg-muted/50 transition-all tap-target active:scale-[0.96]"
                      >
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-xl"
                          style={{ backgroundColor: `${cat.color}15` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: cat.color }} />
                        </div>
                        <span className="text-[10px] font-medium leading-tight text-center text-foreground line-clamp-2 max-w-[64px]">
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
