import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/8 text-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/8 text-destructive",
        outline: "border-border/40 text-foreground bg-card/60 backdrop-blur-sm",
        success: "border-transparent bg-success/8 text-success",
        warning: "border-transparent bg-warning/8 text-warning",
        info: "border-transparent bg-info/8 text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
