import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Upload, X, Link as LinkIcon, Paperclip, ExternalLink, EyeOff, BellRing, ListChecks, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { RichBriefEditor, BriefData } from "@/components/tasks/RichBriefEditor";
import { MultiUserSelect } from "@/components/tasks/MultiUserSelect";
import { sendTaskAssignmentEmail, getUserEmailById } from "@/lib/email-notifications";


interface LinkAttachment {
  name: string;
  url: string;
}

const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  priority: z.enum(["low", "medium", "high"]),
  deadline: z.string().optional(),
  link: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
});

interface CreateTaskDialogProps {
  projects: any[];
  users: any[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateTaskDialog({ projects, users, open: controlledOpen, onOpenChange }: CreateTaskDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    priority: "medium",
    project_id: "",
    deadline: "",
    link: "",
    notes: "",
    is_hidden: false,
  });
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [notifyUsers, setNotifyUsers] = useState<string[]>([]);
  const [subTaskTitles, setSubTaskTitles] = useState<string[]>([]);
  const [newSubTask, setNewSubTask] = useState("");
  const [briefData, setBriefData] = useState<BriefData | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [linkAttachments, setLinkAttachments] = useState<LinkAttachment[]>([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addLinkAttachment = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      toast.error("Please enter both link name and URL");
      return;
    }
    
    try {
      new URL(newLinkUrl);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }
    
    setLinkAttachments(prev => [...prev, { name: newLinkName.trim(), url: newLinkUrl.trim() }]);
    setNewLinkName("");
    setNewLinkUrl("");
    setShowLinkInput(false);
  };

  const removeLinkAttachment = (index: number) => {
    setLinkAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (taskId: string, userId: string) => {
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${taskId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName);

      return {
        task_id: taskId,
        uploaded_by: userId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: urlData.publicUrl,
      };
    });

    const results = await Promise.all(uploadPromises);
    const validAttachments = results.filter(r => r !== null);

    // Add link attachments
    const linkAttachmentData = linkAttachments.map(link => ({
      task_id: taskId,
      uploaded_by: userId,
      file_name: link.name,
      file_url: link.url,
      file_type: 'link',
    }));

    const allAttachments = [...validAttachments, ...linkAttachmentData];

    if (allAttachments.length > 0) {
      await supabase.from('task_attachments').insert(allAttachments);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      taskSchema.parse(formData);
      
      if (!formData.project_id) {
        toast.error("Please select a project");
        return;
      }

      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Use first assignee for backward compatibility in assigned_to column
      const primaryAssignee = assignedUsers.length > 0 ? assignedUsers[0] : null;

      const { data: taskData, error } = await supabase.from("tasks").insert({
        title: formData.title.trim(),
        table_data: briefData as any,
        description: formData.notes.trim() || null,
        priority: formData.priority,
        project_id: formData.project_id,
        assigned_to: primaryAssignee,
        deadline: formData.deadline || null,
        link: formData.link.trim() || null,
        created_by: session.session.user.id,
        status: "pending",
        requested_at: new Date().toISOString(),
        is_hidden: formData.is_hidden,
      }).select('id, share_token').single();

      if (error) throw error;

      // Upload attachments and links if any
      if ((files.length > 0 || linkAttachments.length > 0) && taskData) {
        await uploadFiles(taskData.id, session.session.user.id);
      }

      // Insert all assignees into task_assignees table
      if (taskData && assignedUsers.length > 0) {
        const assigneeInserts = assignedUsers.map(userId => ({
          task_id: taskData.id,
          user_id: userId,
        }));
        await supabase.from("task_assignees").insert(assigneeInserts);
      }

      // Insert watchers into task_watchers table
      if (taskData && notifyUsers.length > 0) {
        const watcherInserts = notifyUsers.map(userId => ({
          task_id: taskData.id,
          user_id: userId,
        }));
        await supabase.from("task_watchers").insert(watcherInserts);
      }

      // Insert sub-tasks if any
      if (taskData && subTaskTitles.length > 0) {
        const subTaskInserts = subTaskTitles.map((title, idx) => ({
          task_id: taskData.id,
          title,
          sort_order: idx,
        }));
        await supabase.from("sub_tasks").insert(subTaskInserts);
      }

      // Log task creation as activity
      await supabase.from("task_activities").insert({
        user_id: session.session.user.id,
        activity_type: 'created',
        task_id: taskData?.id || null,
        task_title: formData.title.trim(),
      });

      // Send email notification to all assignees (async, non-blocking)
      if (assignedUsers.length > 0 && taskData) {
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.session.user.id)
          .single();
        
        // Send email to each assignee
        for (const assigneeId of assignedUsers) {
          sendTaskAssignmentEmail(assigneeId, {
            id: taskData.id,
            title: formData.title.trim(),
            description: formData.notes?.trim(),
            deadline: formData.deadline,
            priority: formData.priority,
            creatorName: creatorProfile?.full_name || "Someone",
            shareToken: taskData.share_token || undefined,
          }).catch(err => console.error("Email notification failed:", err));
        }

        // Send notification to watchers (email + in-app)
        for (const watcherId of notifyUsers) {
          // In-app notification
          supabase.from("task_notifications").insert({
            task_id: taskData.id,
            user_id: watcherId,
            notification_type: "assigned",
            message: `${creatorProfile?.full_name || "Someone"} menambahkan lo sebagai watcher di task "${formData.title.trim()}"`,
            created_by: session.session.user.id,
          }).then(({ error }) => { if (error) console.error("Watcher notification failed:", error); });

          // Email notification  
          sendTaskAssignmentEmail(watcherId, {
            id: taskData.id,
            title: formData.title.trim(),
            description: formData.notes?.trim(),
            deadline: formData.deadline,
            priority: formData.priority,
            creatorName: creatorProfile?.full_name || "Someone",
          }).catch(err => console.error("Watcher email failed:", err));
        }
      }

      toast.success("Task created successfully!");
      setOpen(false);
      setFormData({
        title: "",
        priority: "medium",
        project_id: "",
        deadline: "",
        link: "",
        notes: "",
        is_hidden: false,
      });
      setAssignedUsers([]);
      setNotifyUsers([]);
      setSubTaskTitles([]);
      setNewSubTask("");
      setBriefData(null);
      setFiles([]);
      setLinkAttachments([]);
      setShowLinkInput(false);
      setNewLinkName("");
      setNewLinkUrl("");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["active-tasks"] });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to create task");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Brief / Deskripsi</Label>
            <RichBriefEditor
              data={briefData}
              onChange={setBriefData}
              readOnly={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Catatan tambahan..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <SearchableSelect
                options={(projects || []).map((p) => ({
                  value: p.id,
                  label: p.title,
                  sublabel: p.clients?.name,
                }))}
                value={formData.project_id}
                onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                placeholder="Select project"
                searchPlaceholder="Cari project..."
              />
            </div>

            <div className="space-y-2">
              <Label>Assign To</Label>
              <MultiUserSelect
                users={users || []}
                selectedUserIds={assignedUsers}
                onChange={setAssignedUsers}
                placeholder="Select assignees"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4" />
                Notify To
              </div>
            </Label>
            <MultiUserSelect
              users={(users || []).filter(u => !assignedUsers.includes(u.id))}
              selectedUserIds={notifyUsers}
              onChange={setNotifyUsers}
              placeholder="Pilih orang yang akan dinotifikasi"
            />
            <p className="text-xs text-muted-foreground">Orang yang di-notify akan dapat notifikasi tapi tidak di-assign ke task</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
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

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Reference Link
              </div>
            </Label>
            <Input
              id="link"
              type="url"
              placeholder="https://example.com"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </div>
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLinkInput(!showLinkInput)}
                className="flex-1"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {showLinkInput && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                <Input
                  placeholder="Link name"
                  value={newLinkName}
                  onChange={(e) => setNewLinkName(e.target.value)}
                />
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={addLinkAttachment}>
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowLinkInput(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            {files.length > 0 && (
              <div className="space-y-2 mt-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground mx-2">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {linkAttachments.length > 0 && (
              <div className="space-y-2 mt-2">
                {linkAttachments.map((link, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{link.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLinkAttachment(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-Tasks */}
          <div className="space-y-2">
            <Label>
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Sub-Tasks
              </div>
            </Label>
            {subTaskTitles.length > 0 && (
              <div className="space-y-1">
                {subTaskTitles.map((title, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
                    <Checkbox checked={false} disabled />
                    <span className="flex-1 text-sm">{title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setSubTaskTitles(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Tambah sub-task..."
                value={newSubTask}
                onChange={(e) => setNewSubTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSubTask.trim()) {
                    e.preventDefault();
                    setSubTaskTitles(prev => [...prev, newSubTask.trim()]);
                    setNewSubTask("");
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (newSubTask.trim()) {
                    setSubTaskTitles(prev => [...prev, newSubTask.trim()]);
                    setNewSubTask("");
                  }
                }}
                disabled={!newSubTask.trim()}
                className="h-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="is_hidden" className="text-sm font-medium cursor-pointer">Hidden dari Client</Label>
                <p className="text-xs text-muted-foreground">Task tidak akan muncul di client dashboard</p>
              </div>
            </div>
            <Switch
              id="is_hidden"
              checked={formData.is_hidden}
              onCheckedChange={(checked) => setFormData({ ...formData, is_hidden: checked })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}