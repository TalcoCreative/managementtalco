import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { FloatingActionButton } from "./FloatingActionButton";
import { AIChatPopup } from "@/components/ai/AIChatPopup";
import { useIsMobile } from "@/hooks/use-mobile";
import { PushPermissionPrompt, IOSInstallPrompt } from "@/components/pwa/PushPermissionPrompt";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

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
    <SidebarProvider>
      <div className="flex min-h-screen min-h-[100dvh] w-full overflow-x-hidden">
        {!isMobile && <AppSidebar />}
        <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden">
          <Header />
          <main className="flex-1 p-4 sm:p-5 md:p-8 overflow-x-hidden pb-bottom-nav section-atmospheric">
            {children}
          </main>
        </div>
      </div>
      {isMobile && <MobileBottomNav />}
      <FloatingActionButton />
      <AIChatPopup />
      {shouldShowPrompt && <PushPermissionPrompt onEnable={enableNotifications} />}
      <IOSInstallPrompt />
    </SidebarProvider>
  );
}
