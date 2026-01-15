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
import { Calendar, Clock, MapPin, Video, Users, Building2, Plus, Search, CalendarRange, Lock, ArrowUpDown } from "lucide-react";
import { format, parseISO, isToday, isFuture, isPast, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { id } from "date-fns/locale";
import CreateMeetingDialog from "@/components/meeting/CreateMeetingDialog";
import MeetingDetailDialog from "@/components/meeting/MeetingDetailDialog";
import MeetingNotifications from "@/components/meeting/MeetingNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const Meeting = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  
  // Sort state
  type SortField = "title" | "date" | "type" | "mode" | "participants" | "creator" | "status";
  type SortDirection = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Date range filter for stats - default to current month
  const [statsDateFrom, setStatsDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [statsDateTo, setStatsDateTo] = useState<Date>(endOfMonth(new Date()));

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

  const isSuperAdmin = userRoles?.includes("super_admin");
  const isHRorAdmin = isSuperAdmin || userRoles?.includes("hr");

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getStatusValue = (meeting: any): string => {
    const meetingDate = parseISO(meeting.meeting_date);
    if (meeting.status === "cancelled") return "dibatalkan";
    if (meeting.status === "completed") return "selesai";
    if (isToday(meetingDate)) return "hari_ini";
    if (isFuture(meetingDate)) return "terjadwal";
    return "lewat";
  };

  const filteredMeetings = useMemo(() => {
    let result = meetings?.filter(meeting => {
      // Filter confidential meetings: only creator, participants, and super_admin can see
      if (meeting.is_confidential && currentUser?.id) {
        const isCreator = meeting.created_by === currentUser.id;
        const isParticipant = participants?.some(p => p.meeting_id === meeting.id && p.user_id === currentUser.id);
        const canSeeConfidential = isCreator || isParticipant || isSuperAdmin;
        if (!canSeeConfidential) return false;
      }

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
    }) || [];

    // Sort the filtered results
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "date":
          comparison = a.meeting_date.localeCompare(b.meeting_date) || a.start_time.localeCompare(b.start_time);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "mode":
          comparison = a.mode.localeCompare(b.mode);
          break;
        case "participants":
          comparison = getParticipantCount(a.id) - getParticipantCount(b.id);
          break;
        case "creator":
          comparison = (a.creator?.full_name || "").localeCompare(b.creator?.full_name || "");
          break;
        case "status":
          comparison = getStatusValue(a).localeCompare(getStatusValue(b));
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [meetings, searchTerm, typeFilter, modeFilter, statusFilter, currentUser?.id, participants, isSuperAdmin, sortField, sortDirection]);

  // Filter meetings by date range for stats
  const meetingsInRange = useMemo(() => {
    if (!meetings) return [];
    return meetings.filter(m => {
      const meetingDate = parseISO(m.meeting_date);
      return isWithinInterval(meetingDate, { start: statsDateFrom, end: statsDateTo });
    });
  }, [meetings, statsDateFrom, statsDateTo]);

  // Calculate stats based on filtered date range
  const stats = useMemo(() => {
    if (!meetingsInRange) return { total: 0, internal: 0, external: 0, upcoming: 0 };
    
    return {
      total: meetingsInRange.length,
      internal: meetingsInRange.filter(m => m.type === "internal").length,
      external: meetingsInRange.filter(m => m.type === "external").length,
      upcoming: meetingsInRange.filter(m => {
        const meetingDate = parseISO(m.meeting_date);
        return (isFuture(meetingDate) || isToday(meetingDate)) && m.status !== "cancelled";
      }).length,
    };
  }, [meetingsInRange]);

  // Quick date range presets
  const setThisMonth = () => {
    setStatsDateFrom(startOfMonth(new Date()));
    setStatsDateTo(endOfMonth(new Date()));
  };

  const setLastMonth = () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    setStatsDateFrom(startOfMonth(lastMonth));
    setStatsDateTo(endOfMonth(lastMonth));
  };

  const setThisYear = () => {
    const now = new Date();
    setStatsDateFrom(new Date(now.getFullYear(), 0, 1));
    setStatsDateTo(new Date(now.getFullYear(), 11, 31));
  };

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

        {/* Stats Date Range Filter */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Periode Statistik:</span>
              
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[130px]">
                      {format(statsDateFrom, "dd MMM yyyy", { locale: id })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={statsDateFrom}
                      onSelect={(date) => date && setStatsDateFrom(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[130px]">
                      {format(statsDateTo, "dd MMM yyyy", { locale: id })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={statsDateTo}
                      onSelect={(date) => date && setStatsDateTo(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={setThisMonth}>
                  Bulan Ini
                </Button>
                <Button variant="secondary" size="sm" onClick={setLastMonth}>
                  Bulan Lalu
                </Button>
                <Button variant="secondary" size="sm" onClick={setThisYear}>
                  Tahun Ini
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Meeting</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {format(statsDateFrom, "dd MMM", { locale: id })} - {format(statsDateTo, "dd MMM yyyy", { locale: id })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meeting Mendatang</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.upcoming}</div>
              <p className="text-xs text-muted-foreground">Dalam periode</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Internal</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.internal}</div>
              <p className="text-xs text-muted-foreground">Dalam periode</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">External</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.external}</div>
              <p className="text-xs text-muted-foreground">Dalam periode</p>
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
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("title")}
                    >
                      <div className="flex items-center gap-1">
                        Judul
                        <ArrowUpDown className={`h-4 w-4 ${sortField === "title" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center gap-1">
                        Tanggal & Waktu
                        <ArrowUpDown className={`h-4 w-4 ${sortField === "date" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("type")}
                    >
                      <div className="flex items-center gap-1">
                        Tipe
                        <ArrowUpDown className={`h-4 w-4 ${sortField === "type" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("mode")}
                    >
                      <div className="flex items-center gap-1">
                        Mode
                        <ArrowUpDown className={`h-4 w-4 ${sortField === "mode" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("participants")}
                    >
                      <div className="flex items-center gap-1">
                        Partisipan
                        <ArrowUpDown className={`h-4 w-4 ${sortField === "participants" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("creator")}
                    >
                      <div className="flex items-center gap-1">
                        Dibuat Oleh
                        <ArrowUpDown className={`h-4 w-4 ${sortField === "creator" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        <ArrowUpDown className={`h-4 w-4 ${sortField === "status" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </TableHead>
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
                          <div className="flex items-center gap-2">
                            <p>{meeting.title}</p>
                            {meeting.is_confidential && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <Lock className="w-3 h-3 mr-1" />
                                Rahasia
                              </Badge>
                            )}
                          </div>
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
