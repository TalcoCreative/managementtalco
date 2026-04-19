import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Building2 } from "lucide-react";
import { InvoiceTemplate } from "@/lib/invoice-types";
import { cn } from "@/lib/utils";

interface Props {
  templates: InvoiceTemplate[];
  selectedId: string | null;
  onSelect: (t: InvoiceTemplate) => void;
}

export function TemplateSelector({ templates, selectedId, onSelect }: Props) {
  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        No active templates yet. Create one in Invoice Template Settings.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {templates.map((t) => {
        const selected = selectedId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={cn(
              "group relative text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden",
              selected
                ? "border-primary shadow-elegant scale-[1.01]"
                : "border-border/60 hover:border-primary/40 hover:shadow-soft"
            )}
            style={selected ? { boxShadow: `0 0 0 3px ${t.primary_color}25` } : undefined}
          >
            <div
              className="h-12 w-full"
              style={{
                background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})`,
              }}
            />
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-10 w-10 shrink-0 rounded-lg bg-card border border-border/60 flex items-center justify-center overflow-hidden"
                    style={{ marginTop: "-28px" }}
                  >
                    {t.logo_url ? (
                      <img
                        src={t.logo_url}
                        alt={t.entity_name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
                {selected && (
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-white"
                    style={{ background: t.primary_color }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <h4 className="mt-2 font-semibold text-sm leading-tight">{t.name}</h4>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {t.entity_code}
                </Badge>
                {t.is_default && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    Default
                  </Badge>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
