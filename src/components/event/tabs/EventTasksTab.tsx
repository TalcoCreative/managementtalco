import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface EventTasksTabProps {
  eventId: string;
  projectId: string | null;
  canManage: boolean;
}

const statusColors: Record<string, string> = {
  todo: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  review: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export function EventTasksTab({ eventId, projectId, canManage }: EventTasksTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("medium");

  const { data: tasks, refetch } = useQuery({
    queryKey: ["event-tasks", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          project:projects(title)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const profilesById = useMemo(() => {
    const map = new Map<string, string>();
    (profiles || []).forEach((p) => map.set(p.id, p.full_name));
    return map;
  }, [profiles]);

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.session.user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      // Get a project_id - either from event or create a placeholder
      let taskProjectId = projectId;
      
      if (!taskProjectId) {
        // Get any existing project to link task
        const { data: projects } = await supabase
          .from("projects")
          .select("id")
          .limit(1)
          .single();
        
        if (projects) {
          taskProjectId = projects.id;
        } else {
          throw new Error("No project available. Please create a project first.");
        }
      }

      const { error } = await supabase.from("tasks").insert({
        title,
        description,
        assigned_to: assignedTo || null,
        deadline: deadline || null,
        priority,
        event_id: eventId,
        project_id: taskProjectId,
        created_by: profile.id,
        status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task berhasil ditambahkan");
      resetForm();
      setAddOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error("Error adding task:", error);
      toast.error("Gagal menambahkan task");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status task diperbarui");
      refetch();
    },
    onError: () => {
      toast.error("Gagal memperbarui status");
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAssignedTo("");
    setDeadline("");
    setPriority("medium");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          <h3 className="font-medium">Tasks Event</h3>
          <Badge variant="outline">{tasks?.length || 0} task</Badge>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Task
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                Belum ada task untuk event ini
              </TableCell>
            </TableRow>
          ) : (
            tasks?.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{task.title}</div>
                    {task.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {task.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{task.assigned_to ? (profilesById.get(task.assigned_to) || "-") : "-"}</TableCell>
                <TableCell>
                  {task.deadline 
                    ? format(new Date(task.deadline), "d MMM yyyy", { locale: localeId })
                    : "-"
                  }
                </TableCell>
                <TableCell>
                  <Badge variant={
                    task.priority === "high" ? "destructive" :
                    task.priority === "medium" ? "default" : "secondary"
                  }>
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Select
                      value={task.status || "todo"}
                      onValueChange={(status) => updateStatusMutation.mutate({ id: task.id, status })}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusColors[task.status || "todo"]}>
                      {statusLabels[task.status || "todo"]}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Judul Task *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul task"
              />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi task..."
              />
            </div>
            <div>
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih assignee" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => addTaskMutation.mutate()}
                disabled={addTaskMutation.isPending || !title}
              >
                Tambah
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
