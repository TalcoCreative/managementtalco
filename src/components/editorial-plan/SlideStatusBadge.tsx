import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SlideStatusBadgeProps {
  status: "proposed" | "approved" | "published";
  size?: "sm" | "default";
  variant?: "default" | "light";
}

export function SlideStatusBadge({ status, size = "default", variant = "default" }: SlideStatusBadgeProps) {
  const statusConfig = {
    proposed: {
      label: "Proposed",
      className: variant === "light" 
        ? "bg-yellow-500/20 text-yellow-100 border-yellow-400/30"
        : "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    approved: {
      label: "Approved",
      className: variant === "light"
        ? "bg-green-500/20 text-green-100 border-green-400/30"
        : "bg-green-100 text-green-800 border-green-200",
    },
    published: {
      label: "Published",
      className: variant === "light"
        ? "bg-blue-500/20 text-blue-100 border-blue-400/30"
        : "bg-blue-100 text-blue-800 border-blue-200",
    },
  };

  const config = statusConfig[status] || statusConfig.proposed;

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        size === "sm" && "text-[10px] px-1.5 py-0"
      )}
    >
      {config.label}
    </Badge>
  );
}
