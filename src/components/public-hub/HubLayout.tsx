import { Outlet, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HubBottomNav } from "./HubBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Wrapper layout for all public hub routes.
 * Resolves the client from the URL slug and renders a persistent mobile bottom nav.
 */
export default function HubLayout() {
  const params = useParams();
  const location = useLocation();
  const isMobile = useIsMobile();

  // All hub sub-pages use dashboard_slug — extract from various param names
  const slug = params.slug || params.clientSlug || "";

  const { data: client } = useQuery({
    queryKey: ["hub-layout-client", slug],
    queryFn: async () => {
      if (!slug) return null;

      // For social-media route, slug is social_media_slug — resolve differently
      if (location.pathname.startsWith("/social-media/client/")) {
        const { data } = await supabase
          .from("clients")
          .select("id, name, dashboard_slug, social_media_slug, client_logo")
          .eq("social_media_slug", slug)
          .eq("status", "active")
          .maybeSingle();
        return data;
      }

      const { data } = await supabase
        .from("clients")
        .select("id, name, dashboard_slug, social_media_slug, client_logo")
        .eq("dashboard_slug", slug)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  // Check if marketplace data exists for this client
  const { data: marketplaceCount } = useQuery({
    queryKey: ["hub-layout-marketplace", client?.id],
    queryFn: async () => {
      if (!client?.id) return 0;
      const { count } = await supabase
        .from("marketplace_reports" as any)
        .select("*", { count: "exact", head: true })
        .eq("client_id", client.id);
      return count || 0;
    },
    enabled: !!client?.id,
    staleTime: 5 * 60 * 1000,
  });

  const hubSlug = client?.dashboard_slug || slug;

  return (
    <>
      {/* Add bottom padding on mobile so content isn't covered by nav */}
      <div className={isMobile ? "pb-20" : ""}>
        <Outlet />
      </div>

      {client && isMobile && (
        <HubBottomNav
          clientName={client.name}
          clientSlug={hubSlug}
          dashboardSlug={client.dashboard_slug}
          socialMediaSlug={client.social_media_slug}
          availableFeatures={{
            hasProjects: true,
            hasReports: true,
            hasSocialMedia: !!client.social_media_slug,
            hasEditorialPlans: true,
            hasMeetings: true,
            hasShootings: true,
            hasMarketplace: (marketplaceCount || 0) > 0,
          }}
        />
      )}
    </>
  );
}
