import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SlideStatusBadge } from "./SlideStatusBadge";
import { ImageLightbox } from "./ImageLightbox";
import {
  Image as ImageIcon,
  Video,
  FileText,
  Eye,
  Instagram,
  Youtube,
  Calendar,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ensureActorName } from "@/lib/ep-actor";

interface Slide {
  id: string;
  ep_id: string;
  slide_order: number;
  status: "proposed" | "approved" | "revise" | "published";
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

interface PublicSlideViewProps {
  slide: Slide & { publish_date?: string | null; channel?: string | null; format?: string | null; channels?: string[] | null };
  onLightboxChange?: (open: boolean) => void;
}

const CHANNEL_ICONS: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
};

const FORMAT_LABELS: Record<string, string> = {
  story: "Story",
  carousel: "Carousel",
  single_post: "Single Post",
  long_video: "Long Video",
  shorts: "Shorts",
  feed: "Feed Post",
  reels: "Reels",
};

const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X (Twitter)",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  other: "Other",
};

export function PublicSlideView({ slide, onLightboxChange }: PublicSlideViewProps) {
  const queryClient = useQueryClient();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Editing state
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Slide date editing
  const [editingDate, setEditingDate] = useState(false);
  const [draftDate, setDraftDate] = useState<string>(slide.publish_date || "");
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    setDraftDate(slide.publish_date || "");
    setEditingDate(false);
  }, [slide.id, slide.publish_date]);

  const handleLightboxChange = (open: boolean) => {
    setLightboxOpen(open);
    onLightboxChange?.(open);
  };

  const { data: blocks, refetch: refetchBlocks } = useQuery({
    queryKey: ["public-slide-blocks", slide.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slide_blocks")
        .select("*")
        .eq("slide_id", slide.id)
        .eq("is_internal", false)
        .order("block_order", { ascending: true });

      if (error) throw error;
      return data as Block[];
    },
  });

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    handleLightboxChange(true);
  };

  const startEditing = (block: Block) => {
    setEditingBlockId(block.id);
    setDraft({
      title: block.content?.title || "",
      copywriting: block.content?.copywriting || "",
      caption: block.content?.caption || "",
    });
  };

  const cancelEditing = () => {
    setEditingBlockId(null);
    setDraft({});
  };

  const saveBlock = async (block: Block) => {
    const actor = ensureActorName(slide.ep_id, "Masukkan nama Anda agar perubahan ini tercatat:");
    if (!actor) return;

    setSaving(true);
    try {
      const before = {
        title: block.content?.title ?? null,
        copywriting: block.content?.copywriting ?? null,
        caption: block.content?.caption ?? null,
      };
      const after = {
        title: draft.title,
        copywriting: draft.copywriting,
        caption: draft.caption,
      };

      // Only proceed if something actually changed
      const changed =
        before.title !== after.title ||
        before.copywriting !== after.copywriting ||
        before.caption !== after.caption;

      if (!changed) {
        cancelEditing();
        setSaving(false);
        return;
      }

      const newContent = { ...(block.content || {}), ...after };

      const { error } = await supabase
        .from("slide_blocks")
        .update({ content: newContent })
        .eq("id", block.id);
      if (error) throw error;

      await supabase.from("ep_activity_logs").insert({
        ep_id: slide.ep_id,
        slide_id: slide.id,
        action: "block_updated",
        actor_name: actor,
        details: {
          block_id: block.id,
          block_type: block.block_type,
          before,
          after,
          full_before: block.content,
        },
      });

      toast.success("Perubahan disimpan");
      cancelEditing();
      await refetchBlocks();
      queryClient.invalidateQueries({ queryKey: ["public-slide-blocks", slide.id] });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const savePublishDate = async () => {
    const actor = ensureActorName(slide.ep_id, "Masukkan nama Anda agar perubahan ini tercatat:");
    if (!actor) return;

    if (draftDate === (slide.publish_date || "")) {
      setEditingDate(false);
      return;
    }

    setSavingDate(true);
    try {
      const before = slide.publish_date || null;
      const after = draftDate || null;

      const { error } = await supabase
        .from("editorial_slides")
        .update({ publish_date: after })
        .eq("id", slide.id);
      if (error) throw error;

      await supabase.from("ep_activity_logs").insert({
        ep_id: slide.ep_id,
        slide_id: slide.id,
        action: "slide_updated",
        actor_name: actor,
        details: {
          field: "publish_date",
          before,
          after,
        },
      });

      toast.success("Tanggal tayang diperbarui");
      setEditingDate(false);
      queryClient.invalidateQueries({ queryKey: ["public-editorial-slides"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Gagal menyimpan tanggal");
    } finally {
      setSavingDate(false);
    }
  };

  const renderBlock = (block: Block) => {
    switch (block.block_type) {
      case "status":
        return (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Status:</span>
            <SlideStatusBadge status={slide.status} />
          </div>
        );

      case "content_meta": {
        const ChannelIcon = CHANNEL_ICONS[block.content?.channel] || FileText;
        const isEditing = editingBlockId === block.id;

        return (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {block.content?.format && (
                  <Badge variant="secondary">
                    {FORMAT_LABELS[block.content.format] || block.content.format}
                  </Badge>
                )}
                {block.content?.channel && (
                  <Badge variant="outline" className="gap-1">
                    <ChannelIcon className="h-3 w-3" />
                    {CHANNEL_LABELS[block.content.channel] || block.content.channel}
                  </Badge>
                )}
              </div>
              {!isEditing ? (
                <Button variant="ghost" size="sm" onClick={() => startEditing(block)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Batal
                  </Button>
                  <Button size="sm" onClick={() => saveBlock(block)} disabled={saving}>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {saving ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Judul</p>
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft((d: any) => ({ ...d, title: e.target.value }))}
                    placeholder="Judul konten"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Brief / Idea</p>
                  <Textarea
                    rows={5}
                    value={draft.copywriting}
                    onChange={(e) => setDraft((d: any) => ({ ...d, copywriting: e.target.value }))}
                    placeholder="Brief / ide konten"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Caption</p>
                  <Textarea
                    rows={5}
                    value={draft.caption}
                    onChange={(e) => setDraft((d: any) => ({ ...d, caption: e.target.value }))}
                    placeholder="Caption final untuk publikasi"
                  />
                </div>
              </div>
            ) : (
              <>
                {block.content?.title && (
                  <h3 className="text-xl font-semibold">{block.content.title}</h3>
                )}
                {block.content?.copywriting && (
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-1">Brief / Idea</p>
                    <p className="whitespace-pre-wrap">{block.content.copywriting}</p>
                  </div>
                )}
                {block.content?.caption && (
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm text-muted-foreground font-medium mb-2">Caption</p>
                    <p className="whitespace-pre-wrap text-sm">{block.content.caption}</p>
                  </div>
                )}
              </>
            )}
          </Card>
        );
      }

      case "image": {
        const images = block.content?.images || [];
        if (images.length === 0) return null;
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {images.length > 1 ? `Carousel (${images.length} images)` : "Image"}
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin">
              {images.map((url: string, index: number) => (
                <div
                  key={index}
                  className="relative shrink-0 snap-center cursor-pointer group"
                  onClick={() => openLightbox(images, index)}
                >
                  <img
                    src={url}
                    alt={`Slide ${index + 1}`}
                    className="max-h-[500px] w-auto rounded-lg object-contain hover:opacity-90 transition-opacity"
                  />
                  {images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                      {index + 1}/{images.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      }

      case "video":
        if (!block.content?.embedUrl) return null;
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Video</span>
            </div>
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <iframe src={block.content.embedUrl} className="w-full h-full" allowFullScreen />
            </div>
          </Card>
        );

      case "external_notes":
        if (!block.content?.notes) return null;
        return (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Notes</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{block.content.notes}</p>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      {/* Jadwal Tayang info */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Jadwal Tayang</span>
          </div>

          {editingDate ? (
            <>
              <Input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="h-8 w-auto"
              />
              <Button size="sm" onClick={savePublishDate} disabled={savingDate}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {savingDate ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraftDate(slide.publish_date || "");
                  setEditingDate(false);
                }}
                disabled={savingDate}
              >
                Batal
              </Button>
            </>
          ) : (
            <>
              <Badge variant="secondary" className="text-xs">
                {slide.publish_date
                  ? new Date(slide.publish_date).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Belum dijadwalkan"}
              </Badge>
              {slide.channel && (
                <Badge variant="outline" className="text-xs gap-1">
                  {CHANNEL_LABELS[slide.channel] || slide.channel}
                </Badge>
              )}
              {slide.format && (
                <Badge variant="outline" className="text-xs">
                  {FORMAT_LABELS[slide.format] || slide.format}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setEditingDate(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Ubah tanggal
              </Button>
            </>
          )}
        </div>
      </Card>

      {blocks?.map((block) => (
        <div key={block.id}>{renderBlock(block)}</div>
      ))}

      {(!blocks || blocks.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          No content on this slide
        </div>
      )}

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={handleLightboxChange}
      />
    </div>
  );
}
