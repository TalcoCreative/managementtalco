import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, MapPin, Video, Users, Building2, Plus, Search, Filter } from "lucide-react";
import { format, parseISO, isToday, isFuture, isPast } from "date-fns";
import { id } from "date-fns/locale";
import CreateMeetingDialog from "@/components/meeting/CreateMeetingDialog";
import MeetingDetailDialog from "@/components/meeting/MeetingDetailDialog";
import MeetingNotifications from "@/components/meeting/MeetingNotifications";

const Meeting = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch user roles
  const { data: userRoles } = useQuery({
    queryKey: ["user-roles", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id);
      if (error) throw error;
      return data.map((r) => r.role);
    },
    enabled: !!currentUser?.id,
  });

  const isHRorAdmin = userRoles?.includes("super_admin") || userRoles?.includes("hr");

  // Fetch meetings
  const { data: meetings, isLoading, refetch: refetchMeetings } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          creator:profiles!fk_meetings_created_by(id, full_name),
          client:clients(id, name),
          project:projects(id, title)
        `)
        .order("meeting_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch participants for all meetings
  const { data: participants } = useQuery({
    queryKey: ["meeting-participants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .select(`
          *,
          user:profiles(id, full_name)
        `);
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for display
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (meeting: any) => {
    const meetingDate = parseISO(meeting.meeting_date);
    
    if (meeting.status === "cancelled") {
      return <Badge variant="destructive">Dibatalkan</Badge>;
    }
    if (meeting.status === "completed") {
      return <Badge className="bg-green-500">Selesai</Badge>;
    }
    if (isToday(meetingDate)) {
      return <Badge className="bg-blue-500">Hari Ini</Badge>;
    }
    if (isFuture(meetingDate)) {
      return <Badge variant="outline">Terjadwal</Badge>;
    }
    return <Badge variant="secondary">Lewat</Badge>;
  };

  const getTypeBadge = (type: string) => {
    return type === "internal" ? (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
        <Users className="w-3 h-3 mr-1" />
        Internal
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
        <Building2 className="w-3 h-3 mr-1" />
        External
      </Badge>
    );
  };

  const getModeBadge = (mode: string) => {
    return mode === "online" ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <Video className="w-3 h-3 mr-1" />
        Online
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <MapPin className="w-3 h-3 mr-1" />
        Offline
      </Badge>
    );
  };

  const getParticipantCount = (meetingId: string) => {
    return participants?.filter(p => p.meeting_id === meetingId).length || 0;
  };

  const filteredMeetings = useMemo(() => {
    return meetings?.filter(meeting => {
      const matchesSearch = meeting.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || meeting.type === typeFilter;
      const matchesMode = modeFilter === "all" || meeting.mode === modeFilter;
      
      let matchesStatus = true;
      if (statusFilter !== "all") {
        const meetingDate = parseISO(meeting.meeting_date);
        if (statusFilter === "upcoming") {
          matchesStatus = isFuture(meetingDate) || isToday(meetingDate);
        } else if (statusFilter === "past") {
          matchesStatus = isPast(meetingDate) && !isToday(meetingDate);
        } else if (statusFilter === "completed") {
          matchesStatus = meeting.status === "completed";
        } else if (statusFilter === "cancelled") {
          matchesStatus = meeting.status === "cancelled";
        }
      }
      
      return matchesSearch && matchesType && matchesMode && matchesStatus;
    });
  }, [meetings, searchTerm, typeFilter, modeFilter, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!meetings) return { total: 0, internal: 0, external: 0, upcoming: 0 };
    
    const now = new Date();
    return {
      total: meetings.length,
      internal: meetings.filter(m => m.type === "internal").length,
      external: meetings.filter(m => m.type === "external").length,
      upcoming: meetings.filter(m => {
        const meetingDate = parseISO(m.meeting_date);
        return (isFuture(meetingDate) || isToday(meetingDate)) && m.status !== "cancelled";
      }).length,
    };
  }, [meetings]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Meeting Management</h1>
            <p className="text-muted-foreground">Kelola jadwal meeting internal dan external</p>
          </div>
          <div className="flex gap-2">
            <MeetingNotifications onMeetingClick={setSelectedMeeting} />
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Buat Meeting
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Meeting</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meeting Mendatang</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.upcoming}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Internal</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.internal}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">External</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.external}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari meeting..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Mode</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="upcoming">Mendatang</SelectItem>
                  <SelectItem value="past">Selesai</SelectItem>
                  <SelectItem value="cancelled">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Meetings Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
            ) : filteredMeetings?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada meeting ditemukan
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Judul</TableHead>
                    <TableHead>Tanggal & Waktu</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Partisipan</TableHead>
                    <TableHead>Dibuat Oleh</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMeetings?.map((meeting) => (
                    <TableRow 
                      key={meeting.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedMeeting(meeting)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p>{meeting.title}</p>
                          {meeting.client && (
                            <p className="text-xs text-muted-foreground">
                              Client: {meeting.client.name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p>{format(parseISO(meeting.meeting_date), "dd MMM yyyy", { locale: id })}</p>
                            <p className="text-xs text-muted-foreground">
                              {meeting.start_time.slice(0, 5)} - {meeting.end_time.slice(0, 5)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(meeting.type)}</TableCell>
                      <TableCell>{getModeBadge(meeting.mode)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{getParticipantCount(meeting.id)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{meeting.creator?.full_name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(meeting)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateMeetingDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          refetchMeetings();
          setShowCreateDialog(false);
        }}
      />

      {selectedMeeting && (
        <MeetingDetailDialog
          open={!!selectedMeeting}
          onOpenChange={(open) => !open && setSelectedMeeting(null)}
          meeting={selectedMeeting}
          onUpdate={refetchMeetings}
          isHRorAdmin={isHRorAdmin}
        />
      )}
    </AppLayout>
  );
};

export default Meeting;
