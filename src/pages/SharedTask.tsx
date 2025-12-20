import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Calendar, Building2, User, MessageCircle, Send } from "lucide-react";
import { format } from "date-fns";
import { EditableTaskTable } from "@/components/tasks/EditableTaskTable";
import { useState } from "react";
import { toast } from "sonner";

export default function SharedTask() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [commenterName, setCommenterName] = useState("");
  const [commentContent, setCommentContent] = useState("");

  const { data: task, isLoading, error } = useQuery({
    queryKey: ["shared-task", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          projects(title, clients(name)),
          profiles:profiles!fk_tasks_assigned_to_profiles(full_name)
        `)
        .eq("share_token", token)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Task not found");
      return data as any;
    },
    enabled: !!token,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["shared-task-comments", task?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_public_comments")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!task?.id,
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("task_public_comments")
        .insert({
          task_id: task.id,
          commenter_name: commenterName.trim(),
          content: commentContent.trim(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-task-comments", task?.id] });
      setCommentContent("");
      toast.success("Komentar berhasil ditambahkan");
    },
    onError: () => {
      toast.error("Gagal menambahkan komentar");
    },
  });

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commenterName.trim() || !commentContent.trim()) {
      toast.error("Nama dan komentar harus diisi");
      return;
    }
    addCommentMutation.mutate();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-muted";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-blue-500";
      case "on_hold":
        return "bg-yellow-500";
      case "revise":
        return "bg-orange-500";
      default:
        return "bg-muted";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading task...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Task Not Found</h2>
            <p className="text-muted-foreground">
              This task link may have expired or is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{task.title}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Task Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {task.projects?.clients && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-medium">{task.projects.clients.name}</p>
                  </div>
                </div>
              )}

              {task.profiles?.full_name && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                    <p className="font-medium">{task.profiles.full_name}</p>
                  </div>
                </div>
              )}

              {task.deadline && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    <p className="font-medium">{format(new Date(task.deadline), "PPP")}</p>
                  </div>
                </div>
              )}

              {task.projects && (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Project</p>
                    <p className="font-medium">{task.projects.title}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Task Table */}
            <div>
              <h3 className="font-semibold mb-3">Detail Brief</h3>
              {task.table_data ? (
                <EditableTaskTable
                  data={task.table_data as any}
                  onChange={() => {}}
                  readOnly={true}
                />
              ) : (
                <p className="text-muted-foreground">No details available</p>
              )}
            </div>

            {/* Legacy Description (if exists) */}
            {task.description && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Catatan Tambahan</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5" />
              Komentar ({comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comment List */}
            {comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment: any) => (
                  <div key={comment.id} className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{comment.commenter_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">
                Belum ada komentar
              </p>
            )}

            <Separator />

            {/* Add Comment Form */}
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <Input
                placeholder="Nama Anda"
                value={commenterName}
                onChange={(e) => setCommenterName(e.target.value)}
                required
              />
              <Textarea
                placeholder="Tulis komentar..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                rows={3}
                required
              />
              <Button 
                type="submit" 
                className="w-full"
                disabled={addCommentMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {addCommentMutation.isPending ? "Mengirim..." : "Kirim Komentar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Shared via Talco Creative Indonesia
        </p>
      </div>
    </div>
  );
}
