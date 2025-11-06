import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay } from "date-fns";

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

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

  const getDatesWithEvents = () => {
    const dates: Date[] = [];
    tasks?.forEach(task => {
      if (task.deadline) dates.push(new Date(task.deadline));
    });
    projects?.forEach(project => {
      if (project.deadline) dates.push(new Date(project.deadline));
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

    return { tasks: taskEvents, projects: projectEvents };
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : { tasks: [], projects: [] };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Schedule</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
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
                {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDate && (selectedEvents.tasks.length > 0 || selectedEvents.projects.length > 0) ? (
                <div className="space-y-4">
                  {selectedEvents.projects.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-muted-foreground">Projects</h3>
                      {selectedEvents.projects.map((project: any) => (
                        <div
                          key={project.id}
                          className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
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
                            <Badge variant="outline" className="text-xs">
                              {project.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedEvents.tasks.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-muted-foreground">Tasks</h3>
                      {selectedEvents.tasks.map((task: any) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4 className="font-medium">{task.title}</h4>
                              {task.projects?.clients && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {task.projects.clients.name} - {task.projects.title}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                task.priority === "high"
                                  ? "border-priority-high text-priority-high"
                                  : task.priority === "medium"
                                  ? "border-priority-medium text-priority-medium"
                                  : "border-priority-low text-priority-low"
                              }`}
                            >
                              {task.priority}
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
    </AppLayout>
  );
}
