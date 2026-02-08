import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, LayoutDashboard, BarChart3, Camera, 
  Users, FileText, ArrowRight, AlertCircle, Video 
} from "lucide-react";
import { PublicClientSchedule } from "@/components/public-hub/PublicClientSchedule";

interface ScheduleItem {
  id: string;
  type: "meeting" | "shooting";
  title: string;
  date: string;
  time: string | null;
  endTime: string | null;
  location: string | null;
  mode: string | null;
  meetingLink: string | null;
  status: string;
}

interface EditorialPlanItem {
  id: string;
  title: string;
  period: string | null;
  slug: string;
}

interface ClientHubData {
  client: {
    id: string;
    name: string;
    company: string | null;
    dashboard_slug: string;
    social_media_slug: string | null;
  };
  hasProjects: boolean;
  hasReports: boolean;
  hasSocialMedia: boolean;
  hasEditorialPlans: boolean;
  hasMeetings: boolean;
  hasShootings: boolean;
  schedule: ScheduleItem[];
  editorialPlans: EditorialPlanItem[];
}

export default function PublicClientHub() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<ClientHubData>({
    queryKey: ["public-client-hub", slug],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${baseUrl}/functions/v1/public-client-hub?slug=${encodeURIComponent(slug || "")}`,
        {
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey,
          },
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch client hub");
      }

      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Client Tidak Ditemukan</h1>
          <p className="text-muted-foreground">Link tidak valid atau client sudah tidak aktif.</p>
        </div>
      </div>
    );
  }

  const { client, hasProjects, hasReports, hasSocialMedia, hasEditorialPlans, hasMeetings, hasShootings, schedule, editorialPlans } = data;

  const navigationCards = [
    {
      title: "Dashboard",
      description: "Overview project & progress",
      icon: LayoutDashboard,
      color: "bg-blue-500",
      onClick: () => navigate(`/dashboard/${client.dashboard_slug}`),
      enabled: hasProjects && !!client.dashboard_slug,
    },
    {
      title: "Reports",
      description: "Analytics & performa",
      icon: BarChart3,
      color: "bg-green-500",
      onClick: () => navigate(`/reports/${client.dashboard_slug}`),
      enabled: hasReports && !!client.dashboard_slug,
    },
    {
      title: "Social Media",
      description: "Konten & jadwal",
      icon: Camera,
      color: "bg-orange-500",
      onClick: () => navigate(`/social-media/client/${client.social_media_slug}`),
      enabled: hasSocialMedia,
    },
    {
      title: "Editorial Plan",
      description: "Perencanaan konten",
      icon: FileText,
      color: "bg-purple-500",
      onClick: () => navigate(`/ep-list/${client.dashboard_slug}`),
      enabled: hasEditorialPlans,
    },
    {
      title: "Meeting",
      description: "Jadwal meeting",
      icon: Users,
      color: "bg-indigo-500",
      onClick: () => navigate(`/meeting-list/${client.dashboard_slug}`),
      enabled: hasMeetings,
    },
    {
      title: "Shooting",
      description: "Jadwal shooting",
      icon: Video,
      color: "bg-pink-500",
      onClick: () => navigate(`/shooting-list/${client.dashboard_slug}`),
      enabled: hasShootings,
    },
  ];

  const availableCards = navigationCards.filter(card => card.enabled);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="rounded-xl bg-primary p-2.5 sm:p-3">
              <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{client.name}</h1>
              {client.company && (
                <p className="text-sm text-muted-foreground truncate">{client.company}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Quick Access Cards */}
        {availableCards.length > 0 && (
          <div>
            <h2 className="text-base sm:text-lg font-semibold mb-3">Akses Cepat</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
              {availableCards.map((card) => (
                <Card
                  key={card.title}
                  className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group"
                  onClick={card.onClick}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${card.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                      <card.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <p className="font-medium text-sm">{card.title}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 hidden sm:block">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Schedule Timeline */}
        <PublicClientSchedule
          schedule={schedule || []}
          editorialPlans={editorialPlans || []}
          clientSlug={client.dashboard_slug}
        />

        {/* Empty state when nothing */}
        {availableCards.length === 0 && (!schedule || schedule.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Belum ada modul yang tersedia
              </p>
              <p className="text-sm text-muted-foreground">
                Hubungi tim untuk mengaktifkan akses
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="pt-6 text-center text-xs text-muted-foreground">
          <p>Powered by Talco Management System</p>
        </div>
      </main>
    </div>
  );
}
