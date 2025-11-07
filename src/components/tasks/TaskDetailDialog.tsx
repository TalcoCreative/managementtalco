import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Building2, User, MessageSquare, Paperclip, Upload, Link as LinkIcon, X, File, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface TaskDetailDialogProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ taskId, open, onOpenChange }: TaskDetailDialogProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: task } = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          projects(title, clients(name)),
          profiles(full_name),
          created_by_profile:profiles!tasks_created_by_fkey(full_name)
        `)
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!taskId,
  });

  const { data: comments } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles(full_name)")
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
        .select("*, profiles(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!taskId,
  });

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !taskId) return;
    
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
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

      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
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
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim() || !taskId) return;
    
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          uploaded_by: session.session.user.id,
          file_url: linkUrl,
          file_name: linkUrl,
          file_type: 'link',
        });

      if (error) throw error;

      toast.success("Link added!");
      setLinkUrl("");
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
      if (!session.session) throw new Error("Not authenticated");

      // Delete from storage if it's a file (not a link)
      if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
        const fileName = fileUrl.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('task-attachments')
            .remove([fileName]);
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

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-2xl">{task.title}</DialogTitle>
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Task Info */}
            <div className="space-y-3">
              {task.description && (
                <p className="text-muted-foreground">{task.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                {task.projects?.clients && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{task.projects.clients.name}</span>
                  </div>
                )}
                
                {task.profiles && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{task.profiles.full_name}</span>
                  </div>
                )}

                {task.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(task.deadline), "PPP")}</span>
                  </div>
                )}

                {task.projects && (
                  <div className="col-span-2 text-xs text-muted-foreground">
                    Project: {task.projects.title}
                  </div>
                )}
              </div>
            </div>

            {/* Attachments Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                <h3 className="font-semibold">Attachments ({attachments?.length || 0})</h3>
              </div>

              {/* Add Attachment */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={uploading}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload File"}
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Add a link (https://...)"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    type="url"
                  />
                  <Button 
                    onClick={handleAddLink}
                    disabled={loading || !linkUrl.trim()}
                    size="sm"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Attachments List */}
              <div className="space-y-2">
                {attachments?.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="rounded-lg border bg-card p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {attachment.file_type === 'link' ? (
                        <LinkIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <a
                          href={attachment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline truncate block"
                        >
                          {attachment.file_name}
                        </a>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{attachment.profiles?.full_name}</span>
                          <span>•</span>
                          <span>{format(new Date(attachment.created_at), "PP")}</span>
                          {attachment.file_size && (
                            <>
                              <span>•</span>
                              <span>{(attachment.file_size / 1024).toFixed(1)} KB</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(attachment.file_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(attachment.id, attachment.file_url)}
                      >
                        <X className="h-3 w-3" />
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
  );
}
