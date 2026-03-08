import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, ArrowLeft, Calendar, Clock, MapPin, 
  Video, Users, AlertCircle, Filter, CalendarClock,
  ExternalLink, FileText, Download, ChevronDown, ChevronUp
} from "lucide-react";
import { format, parseISO, isToday, isFuture, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { generateMOMPDF } from "@/lib/mom-pdf";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface MOMItem {
  no: number;
  keterangan: string;
  hasil: string;
}

interface MOMData {
  id: string;
  content: string;
  created_at: string;
}

interface Participant {
  full_name: string | null;
  status: string;
}

interface ExternalParticipant {
  name: string;
  company: string | null;
}

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
  creator: { full_name: string | null } | null;
  mom: MOMData[];
  participants: Participant[];
  external_participants: ExternalParticipant[];
}

interface ClientData {
  id: string;
  name: string;
  company: string | null;
  dashboard_slug: string;
}

const getMonthYearOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -12; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: idLocale }),
    });
  }
  return options;
};

const getStatusBadge = (status: string, meetingDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(meetingDate);
  const isPast = date < today;

  if (status === "cancelled") return <Badge variant="destructive">Dibatalkan</Badge>;
  if (status === "completed" || (status === "scheduled" && isPast))
    return <Badge className="bg-green-500 hover:bg-green-600">Selesai</Badge>;
  if (status === "rescheduled")
    return <Badge variant="outline" className="border-orange-500 text-orange-600">Dijadwal Ulang</Badge>;
  return <Badge variant="secondary">Dijadwalkan</Badge>;
};

const getModeIcon = (mode: string) =>
  mode === "online" ? <Video className="h-4 w-4 text-primary" /> : <MapPin className="h-4 w-4 text-orange-500" />;

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const hasMOM = meeting.mom && meeting.mom.length > 0;

  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
            {meeting.title}
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasMOM && (
              <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
                <FileText className="h-3 w-3 mr-0.5" />
                MOM
              </Badge>
            )}
            {getStatusBadge(meeting.status, meeting.meeting_date)}
          </div>
        </div>
        {meeting.project && (
          <p className="text-sm text-muted-foreground">{meeting.project.name}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{format(new Date(meeting.meeting_date), "EEEE, d MMMM yyyy", { locale: idLocale })}</span>
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
  );
}

function parseMOMContent(content: string): MOMItem[] {
  try {
    const items = JSON.parse(content);
    if (Array.isArray(items)) return items;
  } catch {}
  return [{ no: 1, keterangan: content, hasil: "" }];
}

function MeetingDetailDialog({ meeting, open, onClose, client }: { meeting: Meeting | null; open: boolean; onClose: () => void; client: ClientData | null }) {
  const [momExpanded, setMomExpanded] = useState(true);

  if (!meeting) return null;

  const hasMOM = meeting.mom && meeting.mom.length > 0;

  const handleDownloadPDF = () => {
    if (!hasMOM) return;
    
    // Use first MOM entry
    const momData = meeting.mom[0];
    const momItems = parseMOMContent(momData.content);

    const meetingData = {
      title: meeting.title,
      meeting_date: meeting.meeting_date,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      location: meeting.location || undefined,
      meeting_link: meeting.meeting_link || undefined,
      mode: meeting.mode,
      client: client ? { name: client.name } : undefined,
      project: meeting.project ? { title: meeting.project.name } : undefined,
      creator: meeting.creator ? { full_name: meeting.creator.full_name || "Unknown" } : undefined,
    };

    const participants = (meeting.participants || []).map(p => ({
      user: { full_name: p.full_name || "Unknown" },
      status: p.status,
    }));

    const externalParticipants = (meeting.external_participants || []).map(p => ({
      name: p.name,
      company: p.company || undefined,
    }));

    generateMOMPDF(meetingData, momItems, participants, externalParticipants);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{meeting.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {getStatusBadge(meeting.status, meeting.meeting_date)}
            {meeting.type && <Badge variant="outline" className="capitalize">{meeting.type}</Badge>}
          </div>

          <Separator />

          <div className="space-y-3">
            {meeting.project && (
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="text-sm font-medium">{meeting.project.name}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Tanggal</p>
                <p className="text-sm font-medium">
                  {format(new Date(meeting.meeting_date), "EEEE, d MMMM yyyy", { locale: idLocale })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Waktu</p>
                <p className="text-sm font-medium">{meeting.start_time} - {meeting.end_time}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {getModeIcon(meeting.mode)}
              <div>
                <p className="text-xs text-muted-foreground">Mode</p>
                <p className="text-sm font-medium capitalize">
                  {meeting.mode === "online" ? "Online" : "Offline"}
                </p>
              </div>
            </div>

            {meeting.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Lokasi</p>
                  <p className="text-sm font-medium">{meeting.location}</p>
                </div>
              </div>
            )}

            {meeting.meeting_link && (
              <div className="flex items-start gap-3">
                <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Link Meeting</p>
                  <a
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline break-all"
                  >
                    {meeting.meeting_link}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* MOM Section */}
          {hasMOM && (
            <>
              <Separator />
              <div className="space-y-3">
                <button
                  onClick={() => setMomExpanded(!momExpanded)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold">Minutes of Meeting</h3>
                    <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600">
                      {meeting.mom.length}
                    </Badge>
                  </div>
                  {momExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {momExpanded && (
                  <div className="space-y-3">
                    {meeting.mom.map((momEntry) => {
                      const items = parseMOMContent(momEntry.content);
                      return (
                        <div key={momEntry.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(momEntry.created_at), "d MMM yyyy, HH:mm", { locale: idLocale })}
                            </p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-1.5 px-2 w-8 font-medium text-muted-foreground">No</th>
                                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Keterangan</th>
                                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Hasil</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => (
                                  <tr key={idx} className="border-b last:border-0">
                                    <td className="py-1.5 px-2 text-muted-foreground">{item.no}</td>
                                    <td className="py-1.5 px-2 whitespace-pre-wrap">{item.keterangan}</td>
                                    <td className="py-1.5 px-2 whitespace-pre-wrap">{item.hasil}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                      onClick={handleDownloadPDF}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download MOM (PDF)
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HighlightSection({ title, icon, meetings, onSelect }: {
  title: string;
  icon: React.ReactNode;
  meetings: Meeting[];
  onSelect: (m: Meeting) => void;
}) {
  if (meetings.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
        {icon}
        {title}
        <Badge variant="secondary" className="ml-1">{meetings.length}</Badge>
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {meetings.map((m) => (
          <MeetingCard key={m.id} meeting={m} onClick={() => onSelect(m)} />
        ))}
      </div>
    </div>
  );
}

export default function PublicMeetingList() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const monthOptions = getMonthYearOptions();

  const { data, isLoading } = useQuery<{ client: ClientData; meetings: Meeting[] } | null>({
    queryKey: ["public-meetings-data", clientSlug],
    queryFn: async () => {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/public-meetings?slug=${clientSlug}`,
        { headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" } }
      );
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch meetings");
      }
      return response.json();
    },
    enabled: !!clientSlug,
  });

  const client = data?.client || null;
  const meetings = data?.meetings || [];

  // Today & upcoming
  const todayMeetings = meetings.filter((m) => isToday(parseISO(m.meeting_date)) && m.status !== "cancelled");
  const upcomingMeetings = meetings
    .filter((m) => isFuture(startOfDay(parseISO(m.meeting_date))) && !isToday(parseISO(m.meeting_date)) && m.status !== "cancelled")
    .sort((a, b) => parseISO(a.meeting_date).getTime() - parseISO(b.meeting_date).getTime());

  // Filter by month
  const filteredMeetings = meetings.filter((m) => {
    if (selectedMonth === "all") return true;
    const d = parseISO(m.meeting_date);
    const key = format(d, "yyyy-MM");
    return key === selectedMonth;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/hub/${clientSlug}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="rounded-xl bg-primary p-2">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{client.name}</h1>
              {client.company && <p className="text-sm text-muted-foreground">{client.company}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Today & Upcoming highlights */}
        <HighlightSection
          title="Meeting Hari Ini"
          icon={<CalendarClock className="h-5 w-5 text-green-500" />}
          meetings={todayMeetings}
          onSelect={setSelectedMeeting}
        />
        <HighlightSection
          title="Meeting Mendatang"
          icon={<CalendarClock className="h-5 w-5 text-blue-500" />}
          meetings={upcomingMeetings.slice(0, 6)}
          onSelect={setSelectedMeeting}
        />

        {(todayMeetings.length > 0 || upcomingMeetings.length > 0) && <Separator className="my-6" />}

        {/* All meetings with filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Semua Meeting
            </h2>
            <p className="text-muted-foreground">{filteredMeetings.length} meeting ditemukan</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter bulan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Bulan</SelectItem>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredMeetings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} onClick={() => setSelectedMeeting(meeting)} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {selectedMonth === "all" ? "Belum ada jadwal meeting" : "Tidak ada meeting di bulan ini"}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Powered by Talco Management System</p>
        </div>
      </main>

      <MeetingDetailDialog
        meeting={selectedMeeting}
        open={!!selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        client={client}
      />
    </div>
  );
}