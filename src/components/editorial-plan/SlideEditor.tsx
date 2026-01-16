import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { SlideStatusBadge } from "./SlideStatusBadge";
import { cn } from "@/lib/utils";

interface Slide {
  id: string;
  ep_id: string;
  slide_order: number;
  status: "proposed" | "approved" | "published";
  approved_at: string | null;
  published_at: string | null;
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
}

const CONTENT_FORMATS = [
  { value: "feed", label: "Feed" },
  { value: "carousel", label: "Carousel" },
  { value: "reels", label: "Reels" },
  { value: "story", label: "Story" },
];

const CONTENT_CHANNELS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Other" },
];

export function SlideEditor({ slide, epId, isEditable, onStatusChange }: SlideEditorProps) {
  const queryClient = useQueryClient();
  const [uploadingImage, setUploadingImage] = useState(false);

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

  // Update block mutation
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

  // Update slide status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: "proposed" | "approved" | "published") => {
      const updateData: any = { status: newStatus };
      if (newStatus === "approved") updateData.approved_at = new Date().toISOString();
      if (newStatus === "published") updateData.published_at = new Date().toISOString();

      const { error } = await supabase
        .from("editorial_slides")
        .update(updateData)
        .eq("id", slide.id);

      if (error) throw error;
    },
    onSuccess: () => {
      onStatusChange();
      toast.success("Status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

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
    let timeoutId: NodeJS.Timeout;
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
    const canEdit = isEditable && slide.status !== "published";

    switch (block.block_type) {
      case "status":
        return (
          <Card className="p-4">
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
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </Card>
        );

      case "content_meta":
        return (
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Content Details</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={block.content?.format || "feed"}
                  onValueChange={(value) => handleContentChange(block.id, "format", value)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={block.content?.channel || "instagram"}
                  onValueChange={(value) => handleContentChange(block.id, "channel", value)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_CHANNELS.map((channel) => (
                      <SelectItem key={channel.value} value={channel.value}>
                        {channel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {images.map((url: string, index: number) => (
                  <div key={index} className="relative group aspect-square">
                    <img
                      src={url}
                      alt={`Slide image ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveImage(block.id, url)}
                        className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
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
    </div>
  );
}
