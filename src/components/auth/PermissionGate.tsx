import { usePermissions, PermissionAction } from "@/hooks/usePermissions";

interface PermissionGateProps {
  feature: string;
  action?: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ feature, action = "can_view", children, fallback = null }: PermissionGateProps) {
  const { can, isLoading } = usePermissions();
  
  if (isLoading) return null;
  if (!can(feature, action)) return <>{fallback}</>;
  return <>{children}</>;
}
