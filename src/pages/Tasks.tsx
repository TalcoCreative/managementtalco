import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Archive, AlertTriangle } from "lucide-react";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isPast, parseISO } from "date-fns";

const taskColumns = [
  { id: "pending", title: "Pending" },
  { id: "in_progress", title: "In Progress" },
  { id: "on_hold", title: "On Hold" },
  { id: "revise", title: "Revise" },
];

const isTaskOverdue = (task: any) => {
  if (!task.deadline) return false;
  if (task.status === 'completed' || task.status === 'done') return false;
  return isPast(parseISO(task.deadline));
};

export default function Tasks() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, clients(name)")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ["users-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, status")
        .or("status.is.null,status.eq.active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: activeTasks, isLoading } = useQuery({
    queryKey: ["active-tasks", selectedProject, selectedStatus, selectedUser, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, projects(title, clients(name)), profiles:profiles!fk_tasks_assigned_to_profiles(full_name)")
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      if (selectedUser !== "all") {
        query = query.eq("assigned_to", selectedUser);
      }

      if (startDate) {
        query = query.gte("deadline", startDate);
      }

      if (endDate) {
        query = query.lte("deadline", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: completedTasks, isLoading: loadingCompleted } = useQuery({
    queryKey: ["completed-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(title, clients(name)), profiles:profiles!fk_tasks_assigned_to_profiles(full_name)")
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id)
        .single();
      
      return data?.role;
    },
  });

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", itemId);

    if (error) {
      console.error("Error updating task:", error);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["active-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["completed-tasks"] });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-priority-high";
      case "medium":
        return "bg-priority-medium";
      case "low":
        return "bg-priority-low";
      default:
        return "bg-muted";
    }
  };

  const getCardColor = (task: any) => {
    // Overdue tasks get red styling
    if (isTaskOverdue(task)) {
      return "border-l-4 border-l-destructive bg-gradient-to-r from-destructive/10 to-transparent";
    }
    switch (task.priority) {
      case "high":
        return "border-l-4 border-l-priority-high bg-gradient-to-r from-priority-high/5 to-transparent";
      case "medium":
        return "border-l-4 border-l-priority-medium bg-gradient-to-r from-priority-medium/5 to-transparent";
      case "low":
        return "border-l-4 border-l-priority-low bg-gradient-to-r from-priority-low/5 to-transparent";
      default:
        return "";
    }
  };

  // All authenticated users can create tasks
  const canCreateTasks = !!userRole;

  const clearFilters = () => {
    setSelectedProject("all");
    setSelectedStatus("all");
    setSelectedUser("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold">Tasks</h1>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="default" className="h-10 sm:h-9">
                  <Filter className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  <span className="sm:hidden">Filter</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Filter Tasks</h4>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Project</Label>
                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                      <SelectTrigger className="h-10 sm:h-9">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Status</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="h-10 sm:h-9">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {taskColumns.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Assigned To</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger className="h-10 sm:h-9">
                        <SelectValue placeholder="All Users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Deadline Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          placeholder="Start date"
                          className="h-10 sm:h-9"
                        />
                      </div>
                      <div>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          placeholder="End date"
                          className="h-10 sm:h-9"
                        />
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" onClick={clearFilters} className="w-full h-10 sm:h-9">
                    Clear All Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button onClick={() => setCreateDialogOpen(true)} className="h-10 sm:h-9">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">New Task</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex h-auto">
            <TabsTrigger value="active" className="h-10 sm:h-9 text-sm">Active Tasks</TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2 h-10 sm:h-9 text-sm">
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Completed Tasks</span>
              <span className="sm:hidden">Done</span>
              {completedTasks && completedTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1">{completedTasks.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading tasks...</p>
              </div>
            ) : (
              <KanbanBoard
                columns={taskColumns}
                items={activeTasks || []}
                onStatusChange={handleStatusChange}
                onCardClick={(task) => setSelectedTaskId(task.id)}
                getCardColor={getCardColor}
                renderCard={(task) => (
                  <div className="space-y-2 sm:space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium flex-1 line-clamp-2 text-sm sm:text-base">{task.title}</h4>
                      <div className="flex items-center gap-1">
                        {isTaskOverdue(task) && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Overdue
                          </Badge>
                        )}
                        <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    {task.projects?.clients && (
                      <p className="text-xs sm:text-sm font-medium text-primary truncate">
                        {task.projects.clients.name}
                      </p>
                    )}
                    {task.projects && (
                      <p className="text-xs text-muted-foreground truncate">
                        Project: {task.projects.title}
                      </p>
                    )}
                    {task.deadline && (
                      <p className={`text-xs ${isTaskOverdue(task) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      Due: {new Date(task.deadline).toLocaleDateString()}
                      </p>
                    )}
                    {task.profiles && (
                      <p className="text-xs text-muted-foreground truncate">
                        Assigned: {task.profiles.full_name}
                      </p>
                    )}
                    {task.description && (
                      <p className="text-xs text-muted-foreground italic line-clamp-2 border-t border-border/50 pt-1 mt-1">
                        {task.description}
                      </p>
                    )}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.status}
                        onValueChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                      >
                        <SelectTrigger className="h-9 sm:h-7 text-sm sm:text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...taskColumns, { id: "completed", title: "Completed" }].map((col) => (
                            <SelectItem key={col.id} value={col.id}>
                              {col.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              />
            )}
          </TabsContent>

          <TabsContent value="completed">
            {loadingCompleted ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading completed tasks...</p>
              </div>
            ) : completedTasks && completedTasks.length > 0 ? (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {completedTasks.map((task: any) => (
                  <Card 
                    key={task.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <CardContent className="p-3 sm:p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium flex-1 line-clamp-2 text-sm sm:text-base">{task.title}</h4>
                        <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.projects?.clients && (
                        <p className="text-xs sm:text-sm font-medium text-primary truncate">
                          {task.projects.clients.name}
                        </p>
                      )}
                      {task.projects && (
                        <p className="text-xs text-muted-foreground truncate">
                          Project: {task.projects.title}
                        </p>
                      )}
                      {task.profiles && (
                        <p className="text-xs text-muted-foreground truncate">
                          Assigned: {task.profiles.full_name}
                        </p>
                      )}
                      {task.description && (
                        <p className="text-xs text-muted-foreground italic line-clamp-2 border-t border-border/50 pt-1 mt-1">
                          {task.description}
                        </p>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={task.status}
                          onValueChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                        >
                          <SelectTrigger className="h-9 sm:h-7 text-sm sm:text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...taskColumns, { id: "completed", title: "Completed" }].map((col) => (
                              <SelectItem key={col.id} value={col.id}>
                                {col.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No completed tasks yet
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateTaskDialog 
        projects={projects || []} 
        users={users || []} 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
      
      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </AppLayout>
  );
}
