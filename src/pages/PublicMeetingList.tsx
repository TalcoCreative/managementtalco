import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, ArrowLeft, Calendar, Clock, MapPin, 
  Video, Users, AlertCircle 
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  start_time: string;
  end_time: string;
  mode: string;
  location: string | null;
  meeting_link: string | null;
  status: string;
  type: string;
  project: { name: string } | null;
}

interface ClientData {
  id: string;
  name: string;
  company: string | null;
  dashboard_slug: string;
}

export default function PublicMeetingList() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();

  // Fetch client info
  const { data: client, isLoading: clientLoading } = useQuery<ClientData | null>({
    queryKey: ["public-client-meeting", clientSlug],
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

  // Fetch meetings for client
  const { data: meetings, isLoading: meetingsLoading } = useQuery<Meeting[]>({
    queryKey: ["public-meetings", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          id, title, meeting_date, start_time, end_time, mode, 
          location, meeting_link, status, type,
          projects(name)
        `)
        .eq("client_id", client!.id)
        .eq("is_confidential", false)
        .neq("status", "cancelled")
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        project: m.projects
      })) as Meeting[];
    },
    enabled: !!client?.id,
  });

  const isLoading = clientLoading || meetingsLoading;

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">Selesai</Badge>;
      case "scheduled":
        return <Badge variant="secondary">Dijadwalkan</Badge>;
      case "rescheduled":
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Dijadwal Ulang</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getModeIcon = (mode: string) => {
    return mode === "online" ? (
      <Video className="h-4 w-4 text-blue-500" />
    ) : (
      <MapPin className="h-4 w-4 text-orange-500" />
    );
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
            <Users className="h-5 w-5" />
            Jadwal Meeting
          </h2>
          <p className="text-muted-foreground">
            Daftar meeting yang dijadwalkan
          </p>
        </div>

        {meetings && meetings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <Card 
                key={meeting.id} 
                className="hover:shadow-lg transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">
                      {meeting.title}
                    </CardTitle>
                    {getStatusBadge(meeting.status)}
                  </div>
                  {meeting.project && (
                    <p className="text-sm text-muted-foreground">
                      {meeting.project.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(meeting.meeting_date), "EEEE, d MMMM yyyy", { locale: idLocale })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{meeting.start_time} - {meeting.end_time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {getModeIcon(meeting.mode)}
                    <span className="capitalize">
                      {meeting.mode === "online" ? "Online Meeting" : meeting.location || "Offline"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Belum ada jadwal meeting
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
