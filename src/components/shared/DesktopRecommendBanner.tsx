import { Monitor, X } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/hooks/useLanguage";

interface DesktopRecommendBannerProps {
  featureLabel?: string;
}

export function DesktopRecommendBanner({ featureLabel }: DesktopRecommendBannerProps) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  if (!isMobile || dismissed) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground animate-in fade-in slide-in-from-top-2 duration-300">
      <Monitor className="h-5 w-5 shrink-0 text-primary mt-0.5" />
      <p className="flex-1 leading-relaxed">
        {t(
          `Use the desktop version for a better ${featureLabel || "this feature"} experience with full functionality.`,
          `Gunakan tampilan desktop untuk pengalaman ${featureLabel || "fitur ini"} yang lebih optimal dengan fitur lengkap.`
        )}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 hover:bg-muted/80 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
