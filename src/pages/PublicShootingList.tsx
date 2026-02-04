import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, ArrowLeft, Calendar, Clock, MapPin, 
  Camera, AlertCircle 
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Shooting {
  id: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  location: string | null;
  status: string | null;
  notes: string | null;
  project: { name: string } | null;
}

interface ClientData {
  id: string;
  name: string;
  company: string | null;
  dashboard_slug: string;
}

export default function PublicShootingList() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();

  // Fetch client info
  const { data: client, isLoading: clientLoading } = useQuery<ClientData | null>({
    queryKey: ["public-client-shooting", clientSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, dashboard_slug")
        .eq("dashboard_slug", clientSlug)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clientSlug,
  });

  // Fetch shootings for client
  const { data: shootings, isLoading: shootingsLoading } = useQuery<Shooting[]>({
    queryKey: ["public-shootings", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select(`
          id, title, scheduled_date, scheduled_time, 
          location, status, notes,
          projects(name)
        `)
        .eq("client_id", client!.id)
        .eq("status", "approved")
        .order("scheduled_date", { ascending: false });

      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        project: s.projects
      })) as Shooting[];
    },
    enabled: !!client?.id,
  });

  const isLoading = clientLoading || shootingsLoading;

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

  if (!client) {
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

  const isPastDate = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shootDate = new Date(dateStr);
    return shootDate < today;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(`/hub/${clientSlug}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="rounded-xl bg-primary p-2">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{client.name}</h1>
              {client.company && (
                <p className="text-sm text-muted-foreground">{client.company}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Jadwal Shooting
          </h2>
          <p className="text-muted-foreground">
            Daftar jadwal shooting yang telah disetujui
          </p>
        </div>

        {shootings && shootings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shootings.map((shooting) => (
              <Card 
                key={shooting.id} 
                className="hover:shadow-lg transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">
                      {shooting.title}
                    </CardTitle>
                    {isPastDate(shooting.scheduled_date) ? (
                      <Badge variant="default" className="bg-green-500">Selesai</Badge>
                    ) : (
                      <Badge variant="secondary">Dijadwalkan</Badge>
                    )}
                  </div>
                  {shooting.project && (
                    <p className="text-sm text-muted-foreground">
                      {shooting.project.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(shooting.scheduled_date), "EEEE, d MMMM yyyy", { locale: idLocale })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{shooting.scheduled_time}</span>
                  </div>
                  {shooting.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="line-clamp-1">{shooting.location}</span>
                    </div>
                  )}
                  {shooting.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t">
                      {shooting.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Camera className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Belum ada jadwal shooting
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
