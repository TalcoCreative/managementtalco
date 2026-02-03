import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, LayoutDashboard, BarChart3, Camera, 
  Users, FileText, ArrowRight, AlertCircle 
} from "lucide-react";

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
}

export default function PublicClientHub() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<ClientHubData>({
    queryKey: ["public-client-hub", slug],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${baseUrl}/functions/v1/public-client-hub?slug=${encodeURIComponent(slug || "")}`,
        {
          headers: {
            "Content-Type": "application/json",
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

  const { client, hasProjects, hasReports, hasSocialMedia, hasEditorialPlans } = data;

  const navigationCards = [
    {
      title: "Dashboard",
      description: "Lihat overview project, task, dan progress",
      icon: LayoutDashboard,
      color: "bg-blue-500",
      onClick: () => navigate(`/dashboard/${client.dashboard_slug}`),
      enabled: hasProjects && !!client.dashboard_slug,
    },
    {
      title: "Reports",
      description: "Lihat laporan analytics dan performa social media",
      icon: BarChart3,
      color: "bg-green-500",
      onClick: () => navigate(`/reports/${client.dashboard_slug}`),
      enabled: hasReports && !!client.dashboard_slug,
    },
    {
      title: "Social Media",
      description: "Lihat jadwal dan konten social media",
      icon: Camera,
      color: "bg-orange-500",
      onClick: () => navigate(`/social-media/client/${client.social_media_slug}`),
      enabled: hasSocialMedia,
    },
    {
      title: "Editorial Plan",
      description: "Lihat editorial plan dan konten yang direncanakan",
      icon: FileText,
      color: "bg-purple-500",
      onClick: () => navigate(`/ep/${slug}`),
      enabled: hasEditorialPlans,
    },
  ];

  const availableCards = navigationCards.filter(card => card.enabled);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-primary p-3">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              {client.company && (
                <p className="text-muted-foreground">{client.company}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-1">Client Hub</h2>
          <p className="text-muted-foreground">
            Akses cepat ke semua informasi dan laporan
          </p>
        </div>

        {availableCards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {availableCards.map((card) => (
              <Card
                key={card.title}
                className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 group"
                onClick={card.onClick}
              >
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {card.description}
                  </p>
                  <Button variant="ghost" className="p-0 h-auto text-primary group-hover:translate-x-1 transition-transform">
                    Lihat <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
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
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Powered by Talco Management System</p>
        </div>
      </main>
    </div>
  );
}
