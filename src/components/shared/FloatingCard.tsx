import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import React from "react";

interface FloatingCardProps {
  title: string;
  subtitle?: string;
  status?: string;
  statusVariant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
  metadata?: { label: string; value: string }[];
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function FloatingCard({
  title,
  subtitle,
  status,
  statusVariant = "default",
  metadata,
  actions,
  onClick,
  className,
  children,
}: FloatingCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "floating-card p-4 cursor-pointer active:scale-[0.98] transition-all duration-150",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm sm:text-base truncate">{title}</h4>
          {subtitle && (
            <p className="text-compact-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {status && <Badge variant={statusVariant} className="flex-shrink-0 text-[10px] sm:text-xs">{status}</Badge>}
      </div>

      {metadata && metadata.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
          {metadata.map((m) => (
            <div key={m.label} className="text-compact-sm text-muted-foreground">
              <span className="opacity-60">{m.label}:</span>{" "}
              <span className="text-foreground/80">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}

      {actions && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
          {actions}
        </div>
      )}
    </div>
  );
}
