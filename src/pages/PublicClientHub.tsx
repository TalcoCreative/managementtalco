import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Building2, LayoutDashboard, BarChart3, Camera,
  Users, FileText, ArrowRight, AlertCircle, Video,
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
    client_logo: string | null;
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
      <div className="min-h-[100dvh] hub-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">Memuat...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] hub-gradient flex items-center justify-center px-4">
        <div className="text-center hub-card p-8 rounded-3xl max-w-sm w-full">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Client Tidak Ditemukan</h1>
          <p className="text-sm text-muted-foreground">Link tidak valid atau client sudah tidak aktif.</p>
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
      gradient: "from-[hsl(222,72%,52%)] to-[hsl(222,60%,62%)]",
      onClick: () => navigate(`/dashboard/${client.dashboard_slug}`),
      enabled: hasProjects && !!client.dashboard_slug,
    },
    {
      title: "Reports",
      description: "Analytics & performa",
      icon: BarChart3,
      gradient: "from-[hsl(152,48%,46%)] to-[hsl(152,48%,56%)]",
      onClick: () => navigate(`/reports/${client.dashboard_slug}`),
      enabled: hasReports && !!client.dashboard_slug,
    },
    {
      title: "Social Media",
      description: "Konten & jadwal",
      icon: Camera,
      gradient: "from-[hsl(28,78%,52%)] to-[hsl(38,82%,52%)]",
      onClick: () => navigate(`/social-media/client/${client.social_media_slug}`),
      enabled: hasSocialMedia,
    },
    {
      title: "Editorial Plan",
      description: "Perencanaan konten",
      icon: FileText,
      gradient: "from-[hsl(270,60%,55%)] to-[hsl(280,50%,65%)]",
      onClick: () => navigate(`/ep-list/${client.dashboard_slug}`),
      enabled: hasEditorialPlans,
    },
    {
      title: "Meeting",
      description: "Jadwal meeting",
      icon: Users,
      gradient: "from-[hsl(240,60%,58%)] to-[hsl(250,50%,68%)]",
      onClick: () => navigate(`/meeting-list/${client.dashboard_slug}`),
      enabled: hasMeetings,
    },
    {
      title: "Shooting",
      description: "Jadwal shooting",
      icon: Video,
      gradient: "from-[hsl(330,60%,55%)] to-[hsl(340,50%,65%)]",
      onClick: () => navigate(`/shooting-list/${client.dashboard_slug}`),
      enabled: hasShootings,
    },
  ];

  const availableCards = navigationCards.filter(card => card.enabled);

  return (
    <div className="min-h-[100dvh] hub-gradient">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4" />
        <div className="relative container mx-auto px-4 pt-8 pb-6 sm:pt-12 sm:pb-8">
          <div className="flex flex-col items-center text-center gap-4">
            {/* Client Logo or Fallback */}
            <div className="hub-logo-container w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center overflow-hidden">
              {client.client_logo ? (
                <img
                  src={client.client_logo}
                  alt={`${client.name} logo`}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-bold text-primary-foreground">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{client.name}</h1>
              {client.company && (
                <p className="text-sm sm:text-base text-muted-foreground">{client.company}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-8 space-y-6 sm:space-y-8">
        {/* Quick Access Cards */}
        {availableCards.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Akses Cepat
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
              {availableCards.map((card) => (
                <button
                  key={card.title}
                  onClick={card.onClick}
                  className="hub-card group p-4 sm:p-5 rounded-2xl text-left transition-all duration-200 hover:-translate-y-1 active:scale-[0.97]"
                >
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200 shadow-lg`}>
                    <card.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <p className="font-semibold text-sm">{card.title}</p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed hidden sm:block">
                    {card.description}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Buka <ArrowRight className="h-3 w-3" />
                  </div>
                </button>
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

        {/* Empty state */}
        {availableCards.length === 0 && (!schedule || schedule.length === 0) && (
          <div className="hub-card rounded-2xl border border-dashed border-border/50 p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-base font-medium text-muted-foreground">
              Belum ada modul yang tersedia
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Hubungi tim untuk mengaktifkan akses
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 pb-2 text-center">
          <p className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">
            Powered by Talco Management System
          </p>
        </div>
      </main>
    </div>
  );
}
