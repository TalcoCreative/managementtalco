import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Building2, User, MessageSquare, Paperclip, Upload, Link as LinkIcon, Download, Trash2, X, ExternalLink, Pencil, Save } from "lucide-react";
import { format } from "date-fns";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskDetailDialogProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ taskId, open, onOpenChange }: TaskDetailDialogProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editAssignedTo, setEditAssignedTo] = useState<string>("");
  const [editDeadline, setEditDeadline] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      return session.session?.user?.id || null;
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

  const { data: task } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          projects(title, clients(name)),
          profiles:profiles!fk_tasks_assigned_to_profiles(full_name),
          created_by_profile:profiles!fk_tasks_created_by_profiles(full_name)
        `)
        .eq("id", taskId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!taskId,
  });

  // Reset edit state when task changes
  useEffect(() => {
    if (task) {
      setEditAssignedTo(task.assigned_to || "");
      setEditDeadline(task.deadline || "");
      setIsEditing(false);
    }
  }, [task]);

  const isCreator = currentUser && task?.created_by === currentUser;

  const { data: comments } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles:profiles!fk_comments_author_profiles(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!taskId,
  });

  const { data: attachments } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*, profiles:profiles!fk_task_attachments_uploader_profiles(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!taskId,
  });

  const handleSaveEdit = async () => {
    if (!taskId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          assigned_to: editAssignedTo || null,
          deadline: editDeadline || null,
          assigned_at: editAssignedTo ? new Date().toISOString() : null,
        })
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Task berhasil diupdate");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
      queryClient.invalidateQueries({ queryKey: ["active-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completed-tasks"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal update task");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reason: string) => {
    if (!taskId || !task) return;
    
    setDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Log the deletion
      await supabase.from("deletion_logs").insert({
        entity_type: "task",
        entity_id: taskId,
        entity_name: task.title,
        deleted_by: session.session.user.id,
        reason,
      });

      // Delete the task
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;

      toast.success("Task dihapus");
      setDeleteDialogOpen(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["active-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completed-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus task");
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !taskId) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("comments").insert({
        content: comment,
        task_id: taskId,
        author_id: session.session.user.id,
      });

      if (error) throw error;

      toast.success("Comment added!");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
    } catch (error: any) {
      toast.error(error.message || "Failed to add comment");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !taskId) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    setUploadingFile(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.session.user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        uploaded_by: session.session.user.id,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      toast.success("File uploaded!");
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim() || !linkName.trim() || !taskId) return;

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        uploaded_by: session.session.user.id,
        file_url: linkUrl,
        file_name: linkName,
        file_type: 'link',
      });

      if (error) throw error;

      toast.success("Link added!");
      setLinkUrl("");
      setLinkName("");
      setShowLinkInput(false);
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    } catch (error: any) {
      toast.error(error.message || "Failed to add link");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      // Delete from storage if it's a file (not a link)
      if (fileUrl && fileUrl.includes('task-attachments')) {
        const pathParts = fileUrl.split('task-attachments/')[1];
        if (pathParts) {
          await supabase.storage
            .from('task-attachments')
            .remove([pathParts]);
        }
      }

      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;

      toast.success("Attachment deleted!");
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete attachment");
    }
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

  if (!task) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-2xl break-words">{task.title}</DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap flex-shrink-0">
                {isCreator && !isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                {isEditing && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setEditAssignedTo(task.assigned_to || "");
                        setEditDeadline(task.deadline || "");
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Hapus
                </Button>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 pr-2 sm:pr-4">
            <div className="space-y-4 sm:space-y-6">
              {/* Task Link */}
              {task.link && (
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Reference Link</span>
                  </div>
                  <a 
                    href={task.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {task.link}
                  </a>
                </div>
              )}

              {/* Task Description */}
              {task.description && (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="font-semibold mb-2">Deskripsi / Brief</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

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
                
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                    {isEditing ? (
                      <Select value={editAssignedTo} onValueChange={setEditAssignedTo}>
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{task.profiles?.full_name || "-"}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Deadline</p>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                        className="h-8 mt-1"
                      />
                    ) : (
                      <p className="font-medium">
                        {task.deadline ? format(new Date(task.deadline), "PPP") : "-"}
                      </p>
                    )}
                  </div>
                </div>

                {task.projects && (
                  <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Project</p>
                      <p className="font-medium">{task.projects.title}</p>
                    </div>
                  </div>
                )}

                {task.created_by_profile && (
                  <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Created By</p>
                      <p className="font-medium">{task.created_by_profile.full_name}</p>
                    </div>
                  </div>
                )}

                {task.created_at && (
                  <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Created At</p>
                      <p className="font-medium">{format(new Date(task.created_at), "PPP")}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    <h3 className="font-semibold text-sm sm:text-base">Attachments ({attachments?.length || 0})</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="text-xs sm:text-sm"
                    >
                      <Upload className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">{uploadingFile ? "Uploading..." : "Upload"}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLinkInput(!showLinkInput)}
                      className="text-xs sm:text-sm"
                    >
                      <LinkIcon className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Link</span>
                    </Button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="*/*"
                />

                {/* Add Link Form */}
                {showLinkInput && (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="space-y-2">
                      <Input
                        placeholder="Link URL (e.g., https://example.com)"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                      />
                      <Input
                        placeholder="Link name"
                        value={linkName}
                        onChange={(e) => setLinkName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        onClick={handleAddLink}
                        disabled={loading || !linkUrl.trim() || !linkName.trim()}
                      >
                        Add Link
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowLinkInput(false);
                          setLinkUrl("");
                          setLinkName("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Attachments List */}
                <div className="space-y-2">
                  {attachments?.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="rounded-lg border bg-card p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {attachment.file_type === 'link' ? (
                          <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{attachment.file_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{attachment.profiles?.full_name}</span>
                            <span>•</span>
                            <span>{format(new Date(attachment.created_at), "PPp")}</span>
                            {attachment.file_size && (
                              <>
                                <span>•</span>
                                <span>{(attachment.file_size / 1024 / 1024).toFixed(2)} MB</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {attachment.file_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(attachment.file_url, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAttachment(attachment.id, attachment.file_url)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Comments Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <h3 className="font-semibold">Comments ({comments?.length || 0})</h3>
                </div>

                {/* Add Comment */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                  <Button 
                    onClick={handleSubmitComment} 
                    disabled={loading || !comment.trim()}
                    size="sm"
                  >
                    {loading ? "Posting..." : "Post Comment"}
                  </Button>
                </div>

                {/* Comments List */}
                <div className="space-y-3">
                  {comments?.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border bg-card p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {comment.profiles?.full_name || "Unknown User"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), "PPp")}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus Task"
        description={`Apakah Anda yakin ingin menghapus task "${task.title}"? Tindakan ini tidak dapat dibatalkan.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
