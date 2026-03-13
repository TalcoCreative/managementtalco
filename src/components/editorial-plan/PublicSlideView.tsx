import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SlideStatusBadge } from "./SlideStatusBadge";
import { ImageLightbox } from "./ImageLightbox";
import {
  Image as ImageIcon,
  Video,
  FileText,
  Eye,
  Instagram,
  Youtube,
} from "lucide-react";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleLightboxChange = (open: boolean) => {
    setLightboxOpen(open);
    onLightboxChange?.(open);
  };

  const { data: blocks } = useQuery({
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

  const renderBlock = (block: Block) => {
    switch (block.block_type) {
      case "status":
        return (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Status:</span>
            <SlideStatusBadge status={slide.status} />
          </div>
        );

      case "content_meta":
        const ChannelIcon = CHANNEL_ICONS[block.content?.channel] || FileText;
        return (
          <Card className="p-6 space-y-4">
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
          </Card>
        );

      case "image":
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
    <div className="p-6 max-w-4xl mx-auto space-y-4">
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