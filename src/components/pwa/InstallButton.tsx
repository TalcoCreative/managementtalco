import { Button } from "@/components/ui/button";
import { Download, Check } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useNavigate } from "react-router-dom";

interface InstallButtonProps {
  variant?: "default" | "ghost" | "outline" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  className?: string;
}

export function InstallButton({ 
  variant = "ghost", 
  size = "sm",
  showLabel = true,
  className 
}: InstallButtonProps) {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const navigate = useNavigate();

  const handleClick = async () => {
    if (isInstallable) {
      await promptInstall();
    } else {
      navigate("/install-app");
    }
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
      title="Install Talco App"
    >
      <Download className="h-4 w-4" />
      {showLabel && <span className="ml-2">Install App</span>}
    </Button>
  );
}
