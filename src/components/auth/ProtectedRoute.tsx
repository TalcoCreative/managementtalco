import { useEffect, useState } from "react";
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
    if (isSuperAdmin) return; // super admin has full access

    // Find matching feature key for current path
    const path = location.pathname;
    let featureKey: string | null = null;

    // Exact match first
    if (ROUTE_FEATURE_MAP[path]) {
      featureKey = ROUTE_FEATURE_MAP[path];
    } else {
      // Try prefix match for dynamic routes like /clients/:id, /event/:id, /forms/:id etc
      const sortedRoutes = Object.keys(ROUTE_FEATURE_MAP).sort((a, b) => b.length - a.length);
      for (const route of sortedRoutes) {
        if (path.startsWith(route + "/") || path === route) {
          featureKey = ROUTE_FEATURE_MAP[route];
          break;
        }
      }
    }

    if (featureKey && !canView(featureKey)) {
      toast.error("Anda tidak memiliki akses ke halaman ini.");
      navigate("/");
    }
  }, [location.pathname, loading, permLoading, session, isSuperAdmin, canView, navigate]);

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
