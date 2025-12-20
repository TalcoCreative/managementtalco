import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Building2,
  User,
  MessageCircle,
  Send,
  Link as LinkIcon,
  Paperclip,
  FileText,
  Image,
  File,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { EditableTaskTable } from "@/components/tasks/EditableTaskTable";
import { toast } from "sonner";

type SharedTaskPayload = {
  task: any;
  attachments: any[];
  comments: any[];
};

export default function SharedTask() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [commenterName, setCommenterName] = useState("");
  const [commentContent, setCommentContent] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-task-data", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");

      const { data, error } = await supabase.functions.invoke<SharedTaskPayload>("shared-task", {
        body: { token },
      });

      if (error) throw error;
      if (!data) throw new Error("Failed to load shared task");
      return data;
    },
    enabled: !!token,
  });

  const task = data?.task;
  const attachments = data?.attachments || [];
  const allComments = data?.comments || [];

  const fileAttachments = useMemo(() => {
    return attachments.filter((a: any) => {
      const kind = a.attachment_kind || (a.file_type === "link" ? "link" : "file");
      return kind === "file";
    });
  }, [attachments]);

  const linkAttachments = useMemo(() => {
    return attachments.filter((a: any) => {
      const kind = a.attachment_kind || (a.file_type === "link" ? "link" : "file");
      return kind === "link";
    });
  }, [attachments]);

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) throw new Error("Task not loaded");

      const { error } = await supabase.from("task_public_comments").insert({
        task_id: task.id,
        commenter_name: commenterName.trim(),
        content: commentContent.trim(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-task-data", token] });
      setCommentContent("");
      toast.success("Komentar berhasil ditambahkan");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Gagal menambahkan komentar");
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

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) {
      return <Image className="h-4 w-4" />;
    }
    if (["pdf"].includes(ext || "")) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
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
                  <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Reference Link */}
            {task.link && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Reference Link
                </h3>
                <a
                  href={task.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  {task.link}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {task.link && <Separator />}

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
                <EditableTaskTable data={task.table_data as any} onChange={() => {}} readOnly={true} />
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
                  <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </div>
              </>
            )}

            {/* Attachments Section */}
            {attachments.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({attachments.length})
                  </h3>

                  {fileAttachments.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <p className="text-xs text-muted-foreground font-medium">Files</p>
                      <div className="space-y-2">
                        {fileAttachments.map((attachment: any) => {
                          const href = attachment.signed_url || attachment.file_url;
                          return (
                            <a
                              key={attachment.id}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 transition-colors"
                            >
                              {getFileIcon(attachment.file_name)}
                              <span className="text-sm truncate flex-1">{attachment.file_name}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        File link pakai signed URL supaya bisa dibuka tanpa login.
                      </p>
                    </div>
                  )}

                  {linkAttachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Links</p>
                      <div className="space-y-2">
                        {linkAttachments.map((attachment: any) => {
                          const raw = String(attachment.file_url || "").trim();
                          const href = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
                          return (
                            <a
                              key={attachment.id}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 transition-colors"
                            >
                              <LinkIcon className="h-4 w-4" />
                              <span className="text-sm truncate flex-1">{raw}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
              Komentar ({allComments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {allComments.length > 0 ? (
              <div className="space-y-3">
                {allComments.map((comment: any) => (
                  <div key={`${comment.type}-${comment.id}`} className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {comment.type === "employee"
                            ? comment.profiles?.full_name || "Employee"
                            : comment.commenter_name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {comment.type === "employee" ? "Team" : "External"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">Belum ada komentar</p>
            )}

            <Separator />

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
              <Button type="submit" className="w-full" disabled={addCommentMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {addCommentMutation.isPending ? "Mengirim..." : "Kirim Komentar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Shared via Talco Creative Indonesia</p>
      </div>
    </div>
  );
}
