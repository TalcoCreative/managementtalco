import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, Video, Users, CheckSquare, FolderOpen } from "lucide-react";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedShooting, setSelectedShooting] = useState<any | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);

  // Fetch tasks with deadlines
  const { data: tasks } = useQuery({
    queryKey: ["tasks-with-deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title, clients(name))")
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
        .select("*, clients(name), projects(title)")
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

    return { tasks: taskEvents, projects: projectEvents, meetings: meetingEvents, shootings: shootingEvents };
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : { tasks: [], projects: [], meetings: [], shootings: [] };
  const hasEvents = selectedEvents.tasks.length > 0 || selectedEvents.projects.length > 0 || selectedEvents.meetings.length > 0 || selectedEvents.shootings.length > 0;

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Schedule</h1>
        
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
                              className={`text-xs ${
                                task.priority === "high"
                                  ? "border-red-500 text-red-500"
                                  : task.priority === "medium"
                                  ? "border-yellow-500 text-yellow-500"
                                  : "border-green-500 text-green-500"
                              }`}
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
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedDate ? "No events scheduled for this date" : "Select a date to view events"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
                  <p className="font-medium">{selectedShooting.scheduled_time || '-'}</p>
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
                  <p className="text-muted-foreground">Director</p>
                  <p className="font-medium">{selectedShooting.director || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested By</p>
                  <p className="font-medium">{selectedShooting.profiles?.full_name || '-'}</p>
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
