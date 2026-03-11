import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { usePermissions, ROUTE_FEATURE_MAP } from "@/hooks/usePermissions";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { canView, isSuperAdmin, isLoading: permLoading } = usePermissions();
  const hasCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Permission-based route protection
  useEffect(() => {
    if (loading || permLoading || !session) return;
    if (isSuperAdmin) return;

    const path = location.pathname;
    
    // Don't re-check the same path
    if (hasCheckedRef.current === path) return;

    let featureKey: string | null = null;

    // Routes always accessible to all authenticated users
    const ALWAYS_ACCESSIBLE_ROUTES = ["/profile-settings", "/personal-notes", "/install-app"];
    if (ALWAYS_ACCESSIBLE_ROUTES.some(r => path === r || path.startsWith(r + "/"))) return;

    if (ROUTE_FEATURE_MAP[path]) {
      featureKey = ROUTE_FEATURE_MAP[path];
    } else {
      const sortedRoutes = Object.keys(ROUTE_FEATURE_MAP).sort((a, b) => b.length - a.length);
      for (const route of sortedRoutes) {
        if (path.startsWith(route + "/") || path === route) {
          featureKey = ROUTE_FEATURE_MAP[route];
          break;
        }
      }
    }

    if (featureKey && !canView(featureKey)) {
      hasCheckedRef.current = path;
      toast.error("You do not have access to this page.");
      navigate("/");
    }
  }, [location.pathname, loading, permLoading, session, isSuperAdmin, canView, navigate]);

  // Reset check ref when path changes
  useEffect(() => {
    hasCheckedRef.current = null;
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
