import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { FloatingActionButton } from "./FloatingActionButton";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen min-h-[100dvh] w-full overflow-x-hidden">
        {!isMobile && <AppSidebar />}
        <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden">
          <Header />
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden pb-bottom-nav">
            {children}
          </main>
        </div>
      </div>
      {isMobile && <MobileBottomNav />}
      <FloatingActionButton />
    </SidebarProvider>
  );
}
