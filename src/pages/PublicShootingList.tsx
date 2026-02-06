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
  Camera, AlertCircle, Filter, CalendarClock,
  FileText, StickyNote
} from "lucide-react";
import { format, parseISO, isToday, isFuture, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

const getStatusBadge = (status: string | null, scheduledDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(scheduledDate);
  const isPast = date < today;

  if (status === "cancelled") return <Badge variant="destructive">Dibatalkan</Badge>;
  if (status === "rejected") return <Badge variant="outline" className="border-destructive text-destructive">Ditolak</Badge>;
  if (status === "pending") return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Menunggu Approval</Badge>;
  if (status === "approved" && isPast) return <Badge className="bg-green-500 hover:bg-green-600">Selesai</Badge>;
  if (status === "approved") return <Badge variant="secondary">Disetujui</Badge>;
  return <Badge variant="outline">{status || "Unknown"}</Badge>;
};

function ShootingCard({ shooting, onClick }: { shooting: Shooting; onClick: () => void }) {
  return (
    <Card className="hover:shadow-lg transition-all cursor-pointer group" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
            {shooting.title}
          </CardTitle>
          {getStatusBadge(shooting.status, shooting.scheduled_date)}
        </div>
        {shooting.project && (
          <p className="text-sm text-muted-foreground">{shooting.project.name}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{format(new Date(shooting.scheduled_date), "EEEE, d MMMM yyyy", { locale: idLocale })}</span>
        </div>
        {shooting.scheduled_time && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{shooting.scheduled_time}</span>
          </div>
        )}
        {shooting.location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="line-clamp-1">{shooting.location}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShootingDetailDialog({ shooting, open, onClose }: { shooting: Shooting | null; open: boolean; onClose: () => void }) {
  if (!shooting) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{shooting.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {getStatusBadge(shooting.status, shooting.scheduled_date)}
          </div>

          <Separator />

          <div className="space-y-3">
            {shooting.project && (
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="text-sm font-medium">{shooting.project.name}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Tanggal</p>
                <p className="text-sm font-medium">
                  {format(new Date(shooting.scheduled_date), "EEEE, d MMMM yyyy", { locale: idLocale })}
                </p>
              </div>
            </div>

            {shooting.scheduled_time && (
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Waktu</p>
                  <p className="text-sm font-medium">{shooting.scheduled_time}</p>
                </div>
              </div>
            )}

            {shooting.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Lokasi</p>
                  <p className="text-sm font-medium">{shooting.location}</p>
                </div>
              </div>
            )}

            {shooting.notes && (
              <div className="flex items-start gap-3">
                <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Catatan</p>
                  <p className="text-sm font-medium whitespace-pre-wrap">{shooting.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HighlightSection({ title, icon, shootings, onSelect }: {
  title: string;
  icon: React.ReactNode;
  shootings: Shooting[];
  onSelect: (s: Shooting) => void;
}) {
  if (shootings.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
        {icon}
        {title}
        <Badge variant="secondary" className="ml-1">{shootings.length}</Badge>
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shootings.map((s) => (
          <ShootingCard key={s.id} shooting={s} onClick={() => onSelect(s)} />
        ))}
      </div>
    </div>
  );
}

export default function PublicShootingList() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedShooting, setSelectedShooting] = useState<Shooting | null>(null);

  const monthOptions = getMonthYearOptions();

  const { data, isLoading } = useQuery<{ client: ClientData; shootings: Shooting[] } | null>({
    queryKey: ["public-shootings-data", clientSlug],
    queryFn: async () => {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/public-shootings?slug=${clientSlug}`,
        { headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" } }
      );
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch shootings");
      }
      return response.json();
    },
    enabled: !!clientSlug,
  });

  const client = data?.client || null;
  const shootings = data?.shootings || [];

  // Today & upcoming
  const todayShootings = shootings.filter(
    (s) => isToday(parseISO(s.scheduled_date)) && s.status !== "cancelled" && s.status !== "rejected"
  );
  const upcomingShootings = shootings
    .filter(
      (s) => isFuture(startOfDay(parseISO(s.scheduled_date))) && !isToday(parseISO(s.scheduled_date)) && s.status !== "cancelled" && s.status !== "rejected"
    )
    .sort((a, b) => parseISO(a.scheduled_date).getTime() - parseISO(b.scheduled_date).getTime());

  // Filter by month
  const filteredShootings = shootings.filter((s) => {
    if (selectedMonth === "all") return true;
    const key = format(parseISO(s.scheduled_date), "yyyy-MM");
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
          title="Shooting Hari Ini"
          icon={<CalendarClock className="h-5 w-5 text-green-500" />}
          shootings={todayShootings}
          onSelect={setSelectedShooting}
        />
        <HighlightSection
          title="Shooting Mendatang"
          icon={<CalendarClock className="h-5 w-5 text-blue-500" />}
          shootings={upcomingShootings.slice(0, 6)}
          onSelect={setSelectedShooting}
        />

        {(todayShootings.length > 0 || upcomingShootings.length > 0) && <Separator className="my-6" />}

        {/* All shootings with filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Semua Shooting
            </h2>
            <p className="text-muted-foreground">{filteredShootings.length} shooting ditemukan</p>
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

        {filteredShootings.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredShootings.map((shooting) => (
              <ShootingCard key={shooting.id} shooting={shooting} onClick={() => setSelectedShooting(shooting)} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Camera className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {selectedMonth === "all" ? "Belum ada jadwal shooting" : "Tidak ada shooting di bulan ini"}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Powered by Talco Management System</p>
        </div>
      </main>

      <ShootingDetailDialog
        shooting={selectedShooting}
        open={!!selectedShooting}
        onClose={() => setSelectedShooting(null)}
      />
    </div>
  );
}
