import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { PageSubNav } from "./PageSubNav";
import { GlobalSearch } from "./GlobalSearch";
import { useIsMobile } from "@/hooks/use-mobile";
import { PushPermissionPrompt, IOSInstallPrompt } from "@/components/pwa/PushPermissionPrompt";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TeamReviewGate } from "@/components/team-review/TeamReviewOverlay";
import { AvatarGate } from "@/components/profile/AvatarGate";
import { useLocation } from "react-router-dom";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      return session.session.user;
    },
  });

  const { shouldShowPrompt, enableNotifications } = usePushNotifications(currentUser?.id);

  return (
    <>
      <div className="flex min-h-screen min-h-[100dvh] w-full overflow-x-hidden bg-background">
        {!isMobile && <AppSidebar />}
        <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden relative">
          {/* Atmospheric base layer */}
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.65]"
               style={{
                 backgroundImage:
                   "radial-gradient(ellipse 80% 50% at 80% -10%, hsl(var(--primary) / 0.06), transparent 60%), radial-gradient(ellipse 60% 40% at 0% 10%, hsl(var(--accent) / 0.04), transparent 60%)",
               }}
          />
          <Header />
          <main className="flex-1 px-4 sm:px-6 md:px-8 lg:px-10 py-5 md:py-7 overflow-x-hidden pb-bottom-nav max-w-[1600px] w-full mx-auto">
            <PageSubNav />
            {children}
          </main>
        </div>
      </div>
      {isMobile && <MobileBottomNav />}
      <GlobalSearch />
      {shouldShowPrompt && <PushPermissionPrompt onEnable={enableNotifications} />}
      <IOSInstallPrompt />
      {location.pathname !== "/team-review" && <TeamReviewGate userId={currentUser?.id} />}
      <AvatarGate userId={currentUser?.id} />
    </>
  );
}
