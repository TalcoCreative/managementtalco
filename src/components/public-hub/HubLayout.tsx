import { Outlet, useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HubBottomNav } from "./HubBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Wrapper layout for all public hub routes.
 * Fetches real feature availability from the edge function.
 */
export default function HubLayout() {
  const params = useParams();
  const location = useLocation();
  const isMobile = useIsMobile();

  const slug = params.slug || params.clientSlug || "";

  // Fetch full hub data (same edge function as PublicClientHub) to get real feature flags
  const { data: hubData } = useQuery({
    queryKey: ["hub-layout-data", slug],
    queryFn: async () => {
      if (!slug) return null;

      // For social-media route, we need to resolve the dashboard_slug differently
      // but the edge function only takes dashboard_slug, so we pass the slug as-is
      // and let the hub page handle social_media_slug resolution
      let resolveSlug = slug;

      // If on a social-media route, the slug is social_media_slug — we can't use it directly
      // Skip fetching hub data for social media routes (bottom nav won't have full data)
      if (location.pathname.startsWith("/social-media/client/")) {
        // For social media routes, fetch client by social_media_slug via direct query
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        // We don't have a dedicated endpoint, so we'll use a simple approach
        // Just return minimal data — the bottom nav will use what's available
        return null;
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${baseUrl}/functions/v1/public-client-hub?slug=${encodeURIComponent(resolveSlug)}`,
        { headers: { "Content-Type": "application/json", apikey: apiKey } }
      );

      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  const client = hubData?.client;
  const hubSlug = client?.dashboard_slug || slug;

  return (
    <>
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
            hasProjects: !!hubData?.hasProjects,
            hasReports: !!hubData?.hasReports,
            hasSocialMedia: !!hubData?.hasSocialMedia,
            hasEditorialPlans: !!hubData?.hasEditorialPlans,
            hasMeetings: !!hubData?.hasMeetings,
            hasShootings: !!hubData?.hasShootings,
            hasMarketplace: !!hubData?.hasMarketplace,
            hasKolCampaigns: !!hubData?.hasKolCampaigns,
          }}
        />
      )}
    </>
  );
}
