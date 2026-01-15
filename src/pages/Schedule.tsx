import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Video, Users, CheckSquare, FolderOpen, Filter, List, LayoutGrid, PartyPopper, Home } from "lucide-react";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const getHolidayTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    national: 'Libur Nasional',
    office: 'Libur Kantor',
    special: 'Libur Khusus',
    wfh: 'WFH',
  };
  return labels[type] || type;
};

const getHolidayTypeStyle = (type: string) => {
  const styles: Record<string, string> = {
    national: 'bg-red-500/10 text-red-600 border-red-500/30',
    office: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    special: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    wfh: 'bg-green-500/10 text-green-600 border-green-500/30',
  };
  return styles[type] || 'bg-orange-500/10 text-orange-600 border-orange-500/30';
};

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedShooting, setSelectedShooting] = useState<any | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filterMonth, setFilterMonth] = useState<Date>(new Date());

  // Fetch tasks with deadlines
  const { data: tasks } = useQuery({
    queryKey: ["tasks-with-deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title, clients(name)), assigned_profile:profiles!fk_tasks_assigned_to_profiles(full_name)")
        .not("deadline", "is", null)
        .order("deadline", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch projects with deadlines
  const { data: projects } = useQuery({
    queryKey: ["projects-with-deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(name)")
        .not("deadline", "is", null)
        .order("deadline", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch meetings
  const { data: meetings } = useQuery({
    queryKey: ["meetings-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, clients(name), projects(title), created_by_profile:profiles!fk_meetings_created_by(full_name)")
        .order("meeting_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch shooting schedules
  const { data: shootings } = useQuery({
    queryKey: ["shootings-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select("*, clients(name), projects(title), profiles!shooting_schedules_requested_by_fkey(full_name)")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch holidays
  const { data: holidays } = useQuery({
    queryKey: ["holidays-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .eq("is_active", true)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Helper to check if a date falls within a holiday range
  const getHolidaysForDate = (date: Date) => {
    return holidays?.filter(holiday => {
      const start = new Date(holiday.start_date);
      const end = new Date(holiday.end_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    }) || [];
  };

  const getDatesWithEvents = () => {
    const dates: Date[] = [];
    tasks?.forEach(task => {
      if (task.deadline) dates.push(new Date(task.deadline));
    });
    projects?.forEach(project => {
      if (project.deadline) dates.push(new Date(project.deadline));
    });
    meetings?.forEach(meeting => {
      if (meeting.meeting_date) dates.push(new Date(meeting.meeting_date));
    });
    shootings?.forEach(shooting => {
      if (shooting.scheduled_date) dates.push(new Date(shooting.scheduled_date));
    });
    // Add holiday dates
    holidays?.forEach(holiday => {
      const start = new Date(holiday.start_date);
      const end = new Date(holiday.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
    });
    return dates;
  };

  const getEventsForDate = (date: Date) => {
    const taskEvents = tasks?.filter(task => 
      task.deadline && isSameDay(new Date(task.deadline), date)
    ) || [];
    
    const projectEvents = projects?.filter(project => 
      project.deadline && isSameDay(new Date(project.deadline), date)
    ) || [];

    const meetingEvents = meetings?.filter(meeting => 
      meeting.meeting_date && isSameDay(new Date(meeting.meeting_date), date)
    ) || [];

    const shootingEvents = shootings?.filter(shooting => 
      shooting.scheduled_date && isSameDay(new Date(shooting.scheduled_date), date)
    ) || [];

    const holidayEvents = getHolidaysForDate(date);

    return { tasks: taskEvents, projects: projectEvents, meetings: meetingEvents, shootings: shootingEvents, holidays: holidayEvents };
  };

  const getEventsForMonth = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    
    const taskEvents = tasks?.filter(task => {
      if (!task.deadline) return false;
      const d = parseISO(task.deadline);
      return isWithinInterval(d, { start, end });
    }) || [];
    
    const projectEvents = projects?.filter(project => {
      if (!project.deadline) return false;
      const d = parseISO(project.deadline);
      return isWithinInterval(d, { start, end });
    }) || [];

    const meetingEvents = meetings?.filter(meeting => {
      if (!meeting.meeting_date) return false;
      const d = parseISO(meeting.meeting_date);
      return isWithinInterval(d, { start, end });
    }) || [];

    const shootingEvents = shootings?.filter(shooting => {
      if (!shooting.scheduled_date) return false;
      const d = parseISO(shooting.scheduled_date);
      return isWithinInterval(d, { start, end });
    }) || [];

    const holidayEvents = holidays?.filter(holiday => {
      const holidayStart = parseISO(holiday.start_date);
      const holidayEnd = parseISO(holiday.end_date);
      // Include if any part of the holiday overlaps with the month
      return (holidayStart <= end && holidayEnd >= start);
    }) || [];

    return { tasks: taskEvents, projects: projectEvents, meetings: meetingEvents, shootings: shootingEvents, holidays: holidayEvents };
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : { tasks: [], projects: [], meetings: [], shootings: [], holidays: [] };
  const monthEvents = getEventsForMonth(filterMonth);
  const hasEvents = selectedEvents.tasks.length > 0 || selectedEvents.projects.length > 0 || selectedEvents.meetings.length > 0 || selectedEvents.shootings.length > 0 || selectedEvents.holidays.length > 0;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'completed':
      case 'done':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'pending':
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-red-500 text-red-500";
      case "medium":
        return "border-yellow-500 text-yellow-500";
      default:
        return "border-green-500 text-green-500";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Schedule</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Calendar
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
        </div>

        {viewMode === "calendar" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Calendar
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  modifiers={{
                    hasEvent: getDatesWithEvents(),
                  }}
                  modifiersStyles={{
                    hasEvent: {
                      fontWeight: "bold",
                      textDecoration: "underline",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[500px] overflow-y-auto">
                {selectedDate && hasEvents ? (
                  <div className="space-y-4">
                    {/* Shootings */}
                    {selectedEvents.shootings.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Shootings ({selectedEvents.shootings.length})
                        </h3>
                        {selectedEvents.shootings.map((shooting: any) => (
                          <div
                            key={shooting.id}
                            onClick={() => setSelectedShooting(shooting)}
                            className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{shooting.title || shooting.projects?.title || 'Shooting'}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {shooting.clients?.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {shooting.scheduled_time} • {shooting.location}
                                </p>
                              </div>
                              <Badge className={getStatusColor(shooting.status)}>
                                {shooting.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meetings */}
                    {selectedEvents.meetings.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Meetings ({selectedEvents.meetings.length})
                        </h3>
                        {selectedEvents.meetings.map((meeting: any) => (
                          <div
                            key={meeting.id}
                            onClick={() => setSelectedMeeting(meeting)}
                            className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{meeting.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {meeting.clients?.name} {meeting.projects?.title ? `• ${meeting.projects.title}` : ''}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {meeting.start_time} - {meeting.end_time} • {meeting.mode}
                                </p>
                              </div>
                              <Badge className={getStatusColor(meeting.status)}>
                                {meeting.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tasks */}
                    {selectedEvents.tasks.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                          <CheckSquare className="h-4 w-4" />
                          Task Deadlines ({selectedEvents.tasks.length})
                        </h3>
                        {selectedEvents.tasks.map((task: any) => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{task.title}</h4>
                                {task.projects?.clients && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {task.projects.clients.name} • {task.projects.title}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-xs ${getPriorityColor(task.priority)}`}
                              >
                                {task.priority}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Projects */}
                    {selectedEvents.projects.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          Project Deadlines ({selectedEvents.projects.length})
                        </h3>
                        {selectedEvents.projects.map((project: any) => (
                          <div
                            key={project.id}
                            onClick={() => setSelectedProjectId(project.id)}
                            className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{project.title}</h4>
                                {project.clients && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {project.clients.name}
                                  </p>
                                )}
                              </div>
                              <Badge className={getStatusColor(project.status)}>
                                {project.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Holidays */}
                    {selectedEvents.holidays.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                          <PartyPopper className="h-4 w-4" />
                          Holidays ({selectedEvents.holidays.length})
                        </h3>
                        {selectedEvents.holidays.map((holiday: any) => (
                          <div
                            key={holiday.id}
                            className={`p-3 rounded-lg border ${getHolidayTypeStyle(holiday.holiday_type)}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className="font-medium">{holiday.name}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {getHolidayTypeLabel(holiday.holiday_type)}
                                </p>
                                {holiday.description && (
                                  <p className="text-xs text-muted-foreground">{holiday.description}</p>
                                )}
                              </div>
                              <Badge className={getHolidayTypeStyle(holiday.holiday_type)}>
                                {getHolidayTypeLabel(holiday.holiday_type)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedDate ? "No events scheduled for this date" : "Select a date to view events"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filter by Month
                  </CardTitle>
                  <Select
                    value={format(filterMonth, "yyyy-MM")}
                    onValueChange={(value) => setFilterMonth(new Date(value + "-01"))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const date = new Date(new Date().getFullYear(), i, 1);
                        return (
                          <SelectItem key={i} value={format(date, "yyyy-MM")}>
                            {format(date, "MMMM yyyy")}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="all" className="space-y-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="all">
                  All ({monthEvents.shootings.length + monthEvents.meetings.length + monthEvents.tasks.length + monthEvents.projects.length + monthEvents.holidays.length})
                </TabsTrigger>
                <TabsTrigger value="shootings">
                  <Video className="h-4 w-4 mr-1" />
                  Shootings ({monthEvents.shootings.length})
                </TabsTrigger>
                <TabsTrigger value="meetings">
                  <Users className="h-4 w-4 mr-1" />
                  Meetings ({monthEvents.meetings.length})
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Tasks ({monthEvents.tasks.length})
                </TabsTrigger>
                <TabsTrigger value="projects">
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Projects ({monthEvents.projects.length})
                </TabsTrigger>
                <TabsTrigger value="holidays">
                  <PartyPopper className="h-4 w-4 mr-1" />
                  Holidays ({monthEvents.holidays.length})
                </TabsTrigger>
              </TabsList>

              {/* All Events */}
              <TabsContent value="all">
                <Card>
                  <CardHeader>
                    <CardTitle>All Events - {format(filterMonth, "MMMM yyyy")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-4">
                        {/* Shootings Section */}
                        {monthEvents.shootings.length > 0 && (
                          <div>
                            <h3 className="font-semibold flex items-center gap-2 mb-2">
                              <Video className="h-4 w-4" /> Shootings
                            </h3>
                            {monthEvents.shootings.map((shooting: any) => (
                              <div
                                key={shooting.id}
                                onClick={() => setSelectedShooting(shooting)}
                                className="p-3 border rounded-lg mb-2 hover:bg-accent cursor-pointer"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{shooting.title || 'Shooting'}</p>
                                    <p className="text-sm text-muted-foreground">{shooting.clients?.name} • {shooting.projects?.title}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(shooting.scheduled_date), "dd MMM yyyy")} • {shooting.scheduled_time}</p>
                                  </div>
                                  <Badge className={getStatusColor(shooting.status)}>{shooting.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Meetings Section */}
                        {monthEvents.meetings.length > 0 && (
                          <div>
                            <h3 className="font-semibold flex items-center gap-2 mb-2">
                              <Users className="h-4 w-4" /> Meetings
                            </h3>
                            {monthEvents.meetings.map((meeting: any) => (
                              <div
                                key={meeting.id}
                                onClick={() => setSelectedMeeting(meeting)}
                                className="p-3 border rounded-lg mb-2 hover:bg-accent cursor-pointer"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{meeting.title}</p>
                                    <p className="text-sm text-muted-foreground">{meeting.clients?.name}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(meeting.meeting_date), "dd MMM yyyy")} • {meeting.start_time}</p>
                                  </div>
                                  <Badge className={getStatusColor(meeting.status)}>{meeting.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tasks Section */}
                        {monthEvents.tasks.length > 0 && (
                          <div>
                            <h3 className="font-semibold flex items-center gap-2 mb-2">
                              <CheckSquare className="h-4 w-4" /> Task Deadlines
                            </h3>
                            {monthEvents.tasks.map((task: any) => (
                              <div
                                key={task.id}
                                onClick={() => setSelectedTaskId(task.id)}
                                className="p-3 border rounded-lg mb-2 hover:bg-accent cursor-pointer"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{task.title}</p>
                                    <p className="text-sm text-muted-foreground">{task.projects?.clients?.name} • {task.projects?.title}</p>
                                    <p className="text-xs text-muted-foreground">Deadline: {format(new Date(task.deadline), "dd MMM yyyy")}</p>
                                  </div>
                                  <Badge variant="outline" className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Projects Section */}
                        {monthEvents.projects.length > 0 && (
                          <div>
                            <h3 className="font-semibold flex items-center gap-2 mb-2">
                              <FolderOpen className="h-4 w-4" /> Project Deadlines
                            </h3>
                            {monthEvents.projects.map((project: any) => (
                              <div
                                key={project.id}
                                onClick={() => setSelectedProjectId(project.id)}
                                className="p-3 border rounded-lg mb-2 hover:bg-accent cursor-pointer"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{project.title}</p>
                                    <p className="text-sm text-muted-foreground">{project.clients?.name}</p>
                                    <p className="text-xs text-muted-foreground">Deadline: {format(new Date(project.deadline), "dd MMM yyyy")}</p>
                                  </div>
                                  <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Holidays Section */}
                        {monthEvents.holidays.length > 0 && (
                          <div>
                            <h3 className="font-semibold flex items-center gap-2 mb-2">
                              <PartyPopper className="h-4 w-4" /> Holidays
                            </h3>
                            {monthEvents.holidays.map((holiday: any) => (
                              <div
                                key={holiday.id}
                                className={`p-3 border rounded-lg mb-2 ${getHolidayTypeStyle(holiday.holiday_type)}`}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{holiday.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {getHolidayTypeLabel(holiday.holiday_type)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(holiday.start_date), "dd MMM yyyy")}
                                      {holiday.start_date !== holiday.end_date && ` - ${format(new Date(holiday.end_date), "dd MMM yyyy")}`}
                                    </p>
                                  </div>
                                  <Badge className={getHolidayTypeStyle(holiday.holiday_type)}>{getHolidayTypeLabel(holiday.holiday_type)}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Shootings Tab */}
              <TabsContent value="shootings">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Shootings - {format(filterMonth, "MMMM yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Client / Project</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthEvents.shootings.map((shooting: any) => (
                            <TableRow 
                              key={shooting.id} 
                              className="cursor-pointer hover:bg-accent"
                              onClick={() => setSelectedShooting(shooting)}
                            >
                              <TableCell className="font-medium">{shooting.title || 'Shooting'}</TableCell>
                              <TableCell>
                                <div>{shooting.clients?.name}</div>
                                <div className="text-xs text-muted-foreground">{shooting.projects?.title}</div>
                              </TableCell>
                              <TableCell>
                                <div>{format(new Date(shooting.scheduled_date), "dd MMM yyyy")}</div>
                                <div className="text-xs text-muted-foreground">{shooting.scheduled_time}</div>
                              </TableCell>
                              <TableCell>{shooting.location || '-'}</TableCell>
                              <TableCell>{shooting.profiles?.full_name || '-'}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(shooting.status)}>{shooting.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Meetings Tab */}
              <TabsContent value="meetings">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Meetings - {format(filterMonth, "MMMM yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Client / Project</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthEvents.meetings.map((meeting: any) => (
                            <TableRow 
                              key={meeting.id} 
                              className="cursor-pointer hover:bg-accent"
                              onClick={() => setSelectedMeeting(meeting)}
                            >
                              <TableCell className="font-medium">{meeting.title}</TableCell>
                              <TableCell>
                                <div>{meeting.clients?.name}</div>
                                <div className="text-xs text-muted-foreground">{meeting.projects?.title}</div>
                              </TableCell>
                              <TableCell>{format(new Date(meeting.meeting_date), "dd MMM yyyy")}</TableCell>
                              <TableCell>{meeting.start_time} - {meeting.end_time}</TableCell>
                              <TableCell className="capitalize">{meeting.mode}</TableCell>
                              <TableCell>{meeting.created_by_profile?.full_name || '-'}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(meeting.status)}>{meeting.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5" />
                      Task Deadlines - {format(filterMonth, "MMMM yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Client / Project</TableHead>
                            <TableHead>Deadline</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthEvents.tasks.map((task: any) => (
                            <TableRow 
                              key={task.id} 
                              className="cursor-pointer hover:bg-accent"
                              onClick={() => setSelectedTaskId(task.id)}
                            >
                              <TableCell className="font-medium">{task.title}</TableCell>
                              <TableCell>
                                <div>{task.projects?.clients?.name}</div>
                                <div className="text-xs text-muted-foreground">{task.projects?.title}</div>
                              </TableCell>
                              <TableCell>{format(new Date(task.deadline), "dd MMM yyyy")}</TableCell>
                              <TableCell>{task.assigned_profile?.full_name || 'Unassigned'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                  {task.priority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5" />
                      Project Deadlines - {format(filterMonth, "MMMM yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Deadline</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthEvents.projects.map((project: any) => (
                            <TableRow 
                              key={project.id} 
                              className="cursor-pointer hover:bg-accent"
                              onClick={() => setSelectedProjectId(project.id)}
                            >
                              <TableCell className="font-medium">{project.title}</TableCell>
                              <TableCell>{project.clients?.name}</TableCell>
                              <TableCell>{format(new Date(project.deadline), "dd MMM yyyy")}</TableCell>
                              <TableCell>{project.type || '-'}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Holidays Tab */}
              <TabsContent value="holidays">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PartyPopper className="h-5 w-5" />
                      Holidays - {format(filterMonth, "MMMM yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthEvents.holidays.map((holiday: any) => (
                            <TableRow key={holiday.id}>
                              <TableCell className="font-medium">{holiday.name}</TableCell>
                              <TableCell>
                                <Badge className={getHolidayTypeStyle(holiday.holiday_type)}>
                                  {getHolidayTypeLabel(holiday.holiday_type)}
                                </Badge>
                              </TableCell>
                              <TableCell>{format(new Date(holiday.start_date), "dd MMM yyyy")}</TableCell>
                              <TableCell>{format(new Date(holiday.end_date), "dd MMM yyyy")}</TableCell>
                              <TableCell>{holiday.description || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Task Detail Dialog */}
      {selectedTaskId && (
        <TaskDetailDialog
          taskId={selectedTaskId}
          open={!!selectedTaskId}
          onOpenChange={(open) => !open && setSelectedTaskId(null)}
        />
      )}

      {/* Project Detail Dialog */}
      {selectedProjectId && (
        <ProjectDetailDialog
          projectId={selectedProjectId}
          open={!!selectedProjectId}
          onOpenChange={(open) => !open && setSelectedProjectId(null)}
        />
      )}

      {/* Meeting Detail Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Meeting Details</DialogTitle>
          </DialogHeader>
          {selectedMeeting && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedMeeting.title}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedMeeting.clients?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedMeeting.projects?.title || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedMeeting.meeting_date), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{selectedMeeting.start_time} - {selectedMeeting.end_time}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mode</p>
                  <p className="font-medium capitalize">{selectedMeeting.mode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedMeeting.status)}>{selectedMeeting.status}</Badge>
                </div>
                {selectedMeeting.location && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium">{selectedMeeting.location}</p>
                  </div>
                )}
                {selectedMeeting.meeting_link && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Meeting Link</p>
                    <a href={selectedMeeting.meeting_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {selectedMeeting.meeting_link}
                    </a>
                  </div>
                )}
              </div>
              {selectedMeeting.notes && (
                <div>
                  <p className="text-muted-foreground text-sm">Notes</p>
                  <p className="text-sm mt-1">{selectedMeeting.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Shooting Detail Dialog */}
      <Dialog open={!!selectedShooting} onOpenChange={(open) => !open && setSelectedShooting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Shooting Details</DialogTitle>
          </DialogHeader>
          {selectedShooting && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedShooting.title || selectedShooting.projects?.title || 'Shooting'}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedShooting.clients?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedShooting.projects?.title || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedShooting.scheduled_date), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{selectedShooting.scheduled_time}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{selectedShooting.location || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedShooting.status)}>{selectedShooting.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested By</p>
                  <p className="font-medium">{selectedShooting.profiles?.full_name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedShooting.shooting_type || '-'}</p>
                </div>
              </div>
              {selectedShooting.notes && (
                <div>
                  <p className="text-muted-foreground text-sm">Notes</p>
                  <p className="text-sm mt-1">{selectedShooting.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}