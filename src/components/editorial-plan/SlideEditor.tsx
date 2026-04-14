import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Image as ImageIcon,
  Video,
  FileText,
  Eye,
  EyeOff,
  Trash2,
  Upload,
  GripVertical,
  Plus,
  Calendar,
  Link as LinkIcon,
  ExternalLink,
  Send,
  UserPlus,
} from "lucide-react";
import { SlideStatusBadge } from "./SlideStatusBadge";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./ImageLightbox";

interface Slide {
  id: string;
  ep_id: string;
  slide_order: number;
  status: "proposed" | "approved" | "revise" | "published";
  approved_at: string | null;
  published_at: string | null;
  publish_date: string | null;
  channel: string | null;
  channels: string[] | null;
  format: string | null;
  slug: string | null;
  publish_links: any[] | null;
  assigned_to: string | null;
}

interface Block {
  id: string;
  slide_id: string;
  block_type: "content_meta" | "image" | "video" | "status" | "internal_notes" | "external_notes";
  block_order: number;
  content: any;
  is_internal: boolean;
}

interface SlideEditorProps {
  slide: Slide;
  epId: string;
  isEditable: boolean;
  onStatusChange: () => void;
  onLightboxChange?: (open: boolean) => void;
}

// Universal format options
const CONTENT_FORMATS = [
  { value: "story", label: "Story" },
  { value: "carousel", label: "Carousel" },
  { value: "single_post", label: "Single Post" },
  { value: "long_video", label: "Long Video" },
  { value: "shorts", label: "Shorts" },
];

const CONTENT_CHANNELS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "threads", label: "Threads" },
  { value: "other", label: "Other" },
];

export function SlideEditor({ slide, epId, isEditable, onStatusChange, onLightboxChange }: SlideEditorProps) {
  const queryClient = useQueryClient();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishLinks, setPublishLinks] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedAssignee, setSelectedAssignee] = useState<string>(slide.assigned_to || "");
  const [isSendingTask, setIsSendingTask] = useState(false);

  const handleLightboxOpenChange = (open: boolean) => {
    setLightboxOpen(open);
    onLightboxChange?.(open);
  };

  // Get active channels (prefer new channels array, fallback to legacy channel)
  const activeChannels = slide.channels && slide.channels.length > 0 
    ? slide.channels 
    : (slide.channel ? [slide.channel] : []);

  // Fetch blocks for this slide
  const { data: blocks, refetch: refetchBlocks } = useQuery({
    queryKey: ["slide-blocks", slide.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slide_blocks")
        .select("*")
        .eq("slide_id", slide.id)
        .order("block_order", { ascending: true });

      if (error) throw error;
      return data as Block[];
    },
  });

  // Fetch profiles for assign-to
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data || [];
    },
  });

  // Send slide as task
  const handleSendToTask = async () => {
    if (!selectedAssignee) {
      toast.error("Pilih assignee terlebih dahulu");
      return;
    }
    setIsSendingTask(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Get EP data to find client_id
      const { data: epData } = await supabase.from("editorial_plans").select("id, title, client_id").eq("id", epId).single();
      if (!epData) throw new Error("EP not found");

      // Find or create a project for this client
      let projectId: string;
      const { data: existingProject } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", epData.client_id)
        .limit(1)
        .single();

      if (existingProject) {
        projectId = existingProject.id;
      } else {
        // Get client name
        const { data: clientData } = await supabase.from("clients").select("name").eq("id", epData.client_id).single();
        const { data: newProject, error: projError } = await supabase.from("projects").insert({
          title: `${clientData?.name || "Client"} - Editorial Plan`,
          client_id: epData.client_id,
          status: "active",
        }).select("id").single();
        if (projError) throw projError;
        projectId = newProject!.id;
      }

      // Get content title from blocks
      const contentBlock = blocks?.find(b => b.block_type === "content_meta");
      const contentTitle = contentBlock?.content?.title || `EP Slide ${slide.slide_order + 1}`;

      const taskTitle = `[EP] ${epData.title} - ${contentTitle}`;
      const description = contentBlock?.content?.copywriting || contentBlock?.content?.caption || null;

      // Create task
      const { data: taskData, error: taskError } = await supabase.from("tasks").insert({
        title: taskTitle,
        description,
        project_id: projectId,
        assigned_to: selectedAssignee,
        created_by: session.session.user.id,
        status: "pending",
        requested_at: new Date().toISOString(),
        deadline: slide.publish_date || null,
        ep_slide_id: slide.id,
      } as any).select("id").single();

      if (taskError) throw taskError;

      // Add assignee to task_assignees
      if (taskData) {
        await supabase.from("task_assignees").insert({
          task_id: taskData.id,
          user_id: selectedAssignee,
        });
      }

      // Update slide assigned_to
      await supabase.from("editorial_slides").update({ assigned_to: selectedAssignee } as any).eq("id", slide.id);

      toast.success("Task berhasil dibuat dari slide ini!");
      onStatusChange();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error("Gagal membuat task: " + (error.message || "Unknown error"));
    } finally {
      setIsSendingTask(false);
    }
  };


  const updateBlockMutation = useMutation({
    mutationFn: async ({ blockId, content }: { blockId: string; content: any }) => {
      const { error } = await supabase
        .from("slide_blocks")
        .update({ content })
        .eq("id", blockId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchBlocks();
    },
  });

  // Update slide fields mutation (channels, format, publish_date)
  const updateSlideMutation = useMutation({
    mutationFn: async (fields: Partial<Slide>) => {
      const { error } = await supabase
        .from("editorial_slides")
        .update(fields as any)
        .eq("id", slide.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onStatusChange();
    },
  });

  // Update slide status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: "proposed" | "approved" | "revise" | "published") => {
      if (newStatus === "published") {
        // Open publish dialog to collect links
        setPublishDialogOpen(true);
        // Initialize links for each active channel
        const links: Record<string, string> = {};
        activeChannels.forEach(ch => {
          links[ch] = "";
        });
        // Pre-fill existing publish links
        if (slide.publish_links && Array.isArray(slide.publish_links)) {
          slide.publish_links.forEach((pl: any) => {
            if (pl.platform && pl.url) links[pl.platform] = pl.url;
          });
        }
        setPublishLinks(links);
        return; // Don't update yet, wait for dialog confirmation
      }

      const updateData: any = { status: newStatus };
      if (newStatus === "approved") updateData.approved_at = new Date().toISOString();

      const { error } = await supabase
        .from("editorial_slides")
        .update(updateData)
        .eq("id", slide.id);

      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      if (newStatus !== "published") {
        onStatusChange();
        toast.success("Status updated");
      }
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  // Confirm publish with links
  const handleConfirmPublish = async () => {
    const linksArray = Object.entries(publishLinks)
      .filter(([_, url]) => url.trim() !== "")
      .map(([platform, url]) => ({ platform, url: url.trim() }));

    const updateData: any = {
      status: "published",
      published_at: new Date().toISOString(),
      publish_links: linksArray,
    };

    const { error } = await supabase
      .from("editorial_slides")
      .update(updateData)
      .eq("id", slide.id);

    if (error) {
      toast.error("Gagal publish");
      return;
    }

    setPublishDialogOpen(false);
    onStatusChange();
    toast.success("Content published!");
  };

  // Toggle channel in channels array
  const handleToggleChannel = (channelValue: string) => {
    const current = [...activeChannels];
    const idx = current.indexOf(channelValue);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(channelValue);
    }
    // Update both channels array and legacy channel field
    updateSlideMutation.mutate({
      channels: current,
      channel: current[0] || null,
      // Reset format if no channels
      format: current.length > 0 ? (slide.format || "single_post") : null,
    } as any);
  };

  // Add block mutation
  const addBlockMutation = useMutation({
    mutationFn: async (blockType: Block["block_type"]) => {
      const newOrder = (blocks?.length || 0);
      const defaultContent: Record<string, any> = {
        content_meta: { title: "", copywriting: "", caption: "", format: "feed", channel: "instagram" },
        image: { images: [] },
        video: { embedUrl: "" },
        status: {},
        internal_notes: { notes: "" },
        external_notes: { notes: "" },
      };

      const { error } = await supabase.from("slide_blocks").insert({
        slide_id: slide.id,
        block_type: blockType,
        block_order: newOrder,
        content: defaultContent[blockType] || {},
        is_internal: blockType === "internal_notes",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      refetchBlocks();
      toast.success("Block added");
    },
  });

  // Delete block mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase
        .from("slide_blocks")
        .delete()
        .eq("id", blockId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchBlocks();
      toast.success("Block deleted");
    },
  });

  const handleImageUpload = async (blockId: string, files: FileList) => {
    setUploadingImage(true);
    const block = blocks?.find(b => b.id === blockId);
    const existingImages = block?.content?.images || [];

    try {
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${epId}/${slide.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("ep-assets")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("ep-assets")
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      await updateBlockMutation.mutateAsync({
        blockId,
        content: { images: [...existingImages, ...uploadedUrls] },
      });

      toast.success("Images uploaded");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload images");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async (blockId: string, imageUrl: string) => {
    const block = blocks?.find(b => b.id === blockId);
    const existingImages = block?.content?.images || [];
    const updatedImages = existingImages.filter((url: string) => url !== imageUrl);

    await updateBlockMutation.mutateAsync({
      blockId,
      content: { images: updatedImages },
    });
  };

  const debounce = useCallback((fn: Function, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }, []);

  const handleContentChange = debounce((blockId: string, field: string, value: any) => {
    const block = blocks?.find(b => b.id === blockId);
    if (!block) return;

    updateBlockMutation.mutate({
      blockId,
      content: { ...block.content, [field]: value },
    });
  }, 500);

  const renderBlock = (block: Block) => {
    const canEdit = isEditable;

    switch (block.block_type) {
      case "status":
        return (
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <SlideStatusBadge status={slide.status} />
              </div>
              {canEdit && (
                <Select
                  value={slide.status}
                  onValueChange={(value: any) => updateStatusMutation.mutate(value)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposed">Proposed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="revise">Revise</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Publish Date & Format */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Tanggal Tayang
                </Label>
                <Input
                  type="date"
                  value={slide.publish_date || ""}
                  onChange={(e) => updateSlideMutation.mutate({ publish_date: e.target.value || null } as any)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={slide.format || "single_post"}
                  onValueChange={(value) => updateSlideMutation.mutate({ format: value } as any)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_FORMATS.map((fmt) => (
                      <SelectItem key={fmt.value} value={fmt.value}>
                        {fmt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multi-Channel Selection */}
            <div className="space-y-2">
              <Label>Platform / Channel</Label>
              <div className="flex flex-wrap gap-3">
                {CONTENT_CHANNELS.map((ch) => {
                  const isChecked = activeChannels.includes(ch.value);
                  return (
                    <label
                      key={ch.value}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-sm",
                        isChecked ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted",
                        !canEdit && "opacity-60 cursor-default"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => canEdit && handleToggleChannel(ch.value)}
                        disabled={!canEdit}
                        className="h-3.5 w-3.5"
                      />
                      {ch.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Published Links Display */}
            {slide.status === "published" && slide.publish_links && Array.isArray(slide.publish_links) && slide.publish_links.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Link Publish
                </Label>
                <div className="space-y-1.5">
                  {slide.publish_links.map((link: any, idx: number) => {
                    const channelLabel = CONTENT_CHANNELS.find(c => c.value === link.platform)?.label || link.platform;
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs shrink-0">{channelLabel}</Badge>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate flex items-center gap-1"
                        >
                          {link.url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        );

      case "content_meta":
        return (
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Content Details</span>
            </div>

            <div className="space-y-2">
              <Label>Content Title</Label>
              <Input
                defaultValue={block.content?.title || ""}
                onChange={(e) => handleContentChange(block.id, "title", e.target.value)}
                placeholder="Judul konten..."
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label>Copywriting / Brief</Label>
              <Textarea
                defaultValue={block.content?.copywriting || ""}
                onChange={(e) => handleContentChange(block.id, "copywriting", e.target.value)}
                placeholder="Brief atau ide konten..."
                rows={3}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label>Caption</Label>
              <Textarea
                defaultValue={block.content?.caption || ""}
                onChange={(e) => handleContentChange(block.id, "caption", e.target.value)}
                placeholder="Caption untuk posting..."
                rows={4}
                disabled={!canEdit}
              />
            </div>
          </Card>
        );

      case "image":
        const images = block.content?.images || [];
        return (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Images / Carousel</span>
              </div>
            </div>

            {images.length > 0 && (
              <div className="mb-4">
                <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin">
                  {images.map((url: string, index: number) => (
                    <div key={index} className="relative group shrink-0 snap-center cursor-pointer"
                      onClick={() => { setLightboxImages(images); setLightboxIndex(index); handleLightboxOpenChange(true); }}
                    >
                      <img
                        src={url}
                        alt={`Slide image ${index + 1}`}
                        className="max-h-[400px] w-auto rounded-lg object-contain hover:opacity-90 transition-opacity"
                      />
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveImage(block.id, url)}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      {images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                          {index + 1}/{images.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => e.target.files && handleImageUpload(block.id, e.target.files)}
                  className="hidden"
                  id={`image-upload-${block.id}`}
                  disabled={uploadingImage}
                />
                <label
                  htmlFor={`image-upload-${block.id}`}
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploadingImage ? "Uploading..." : "Click to upload images"}
                  </span>
                </label>
              </div>
            )}
          </Card>
        );

      case "video":
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Video Embed</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Embed URL (YouTube, Google Drive, Loom)</Label>
                <Input
                  defaultValue={block.content?.embedUrl || ""}
                  onChange={(e) => handleContentChange(block.id, "embedUrl", e.target.value)}
                  placeholder="https://..."
                  disabled={!canEdit}
                />
              </div>

              {block.content?.embedUrl && (
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <iframe
                    src={block.content.embedUrl}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </Card>
        );

      case "internal_notes":
        return (
          <Card className="p-4 border-orange-200 bg-orange-50/50">
            <div className="flex items-center gap-2 mb-4">
              <EyeOff className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-800">Internal Notes</span>
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Hidden from client
              </Badge>
            </div>

            <Textarea
              defaultValue={block.content?.notes || ""}
              onChange={(e) => handleContentChange(block.id, "notes", e.target.value)}
              placeholder="Catatan internal (tidak terlihat oleh client)..."
              rows={3}
              disabled={!canEdit}
              className="bg-white"
            />
          </Card>
        );

      case "external_notes":
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Notes for Client</span>
            </div>

            <Textarea
              defaultValue={block.content?.notes || ""}
              onChange={(e) => handleContentChange(block.id, "notes", e.target.value)}
              placeholder="Catatan untuk client..."
              rows={3}
              disabled={!canEdit}
            />
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Blocks */}
      {blocks?.map((block) => (
        <div key={block.id} className="group relative">
          {isEditable && (
            <button
              onClick={() => deleteBlockMutation.mutate(block.id)}
              className="absolute -right-2 -top-2 bg-destructive text-destructive-foreground p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          {renderBlock(block)}
        </div>
      ))}

      {/* Add Block */}
      {isEditable && (
        <Card className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Add block:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addBlockMutation.mutate("content_meta")}
            >
              <FileText className="h-4 w-4 mr-1" />
              Content
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addBlockMutation.mutate("image")}
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              Image
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addBlockMutation.mutate("video")}
            >
              <Video className="h-4 w-4 mr-1" />
              Video
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addBlockMutation.mutate("internal_notes")}
            >
              <EyeOff className="h-4 w-4 mr-1" />
              Internal Notes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addBlockMutation.mutate("external_notes")}
            >
              <Eye className="h-4 w-4 mr-1" />
              Client Notes
            </Button>
          </div>
        </Card>
      )}

      {/* Publish Dialog - Collect Links */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Masukkan link publish untuk setiap platform:
            </p>
            {Object.keys(publishLinks).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Belum ada platform dipilih. Pilih platform di Status block terlebih dahulu.
              </p>
            ) : (
              Object.entries(publishLinks).map(([platform, url]) => {
                const label = CONTENT_CHANNELS.find(c => c.value === platform)?.label || platform;
                return (
                  <div key={platform} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input
                      value={url}
                      onChange={(e) => setPublishLinks(prev => ({ ...prev, [platform]: e.target.value }))}
                      placeholder={`Link ${label}...`}
                    />
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleConfirmPublish} className="bg-green-600 hover:bg-green-700">
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={handleLightboxOpenChange}
      />
    </div>
  );
}
