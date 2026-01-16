import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  ArrowLeft,
  GripVertical,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SlideEditor } from "@/components/editorial-plan/SlideEditor";
import { SlideStatusBadge } from "@/components/editorial-plan/SlideStatusBadge";
import { EPCommentsPanel } from "@/components/editorial-plan/EPCommentsPanel";

interface Slide {
  id: string;
  ep_id: string;
  slide_order: number;
  status: "proposed" | "approved" | "published";
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
}

interface EditorialPlanData {
  id: string;
  title: string;
  slug: string;
  period: string | null;
  client_id: string;
  clients?: {
    id: string;
    name: string;
  };
}

export default function EditorialPlanEditor() {
  const { clientSlug, epSlug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);

  // Fetch EP data
  const { data: ep, isLoading: epLoading } = useQuery({
    queryKey: ["editorial-plan", clientSlug, epSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editorial_plans")
        .select(`
          *,
          clients(id, name)
        `)
        .eq("slug", epSlug)
        .single();

      if (error) throw error;
      return data as EditorialPlanData;
    },
  });

  // Fetch slides
  const { data: slides, isLoading: slidesLoading, refetch: refetchSlides } = useQuery({
    queryKey: ["editorial-slides", ep?.id],
    queryFn: async () => {
      if (!ep?.id) return [];
      const { data, error } = await supabase
        .from("editorial_slides")
        .select("*")
        .eq("ep_id", ep.id)
        .order("slide_order", { ascending: true });

      if (error) throw error;
      return data as Slide[];
    },
    enabled: !!ep?.id,
  });

  const currentSlide = slides?.[currentSlideIndex];

  // Add slide mutation
  const addSlideMutation = useMutation({
    mutationFn: async () => {
      if (!ep?.id) throw new Error("No EP");

      const newOrder = (slides?.length || 0);
      const { data: slide, error } = await supabase
        .from("editorial_slides")
        .insert({
          ep_id: ep.id,
          slide_order: newOrder,
          status: "proposed",
        })
        .select()
        .single();

      if (error) throw error;

      // Add default blocks
      const defaultBlocks: Array<{
        slide_id: string;
        block_type: "content_meta" | "image" | "video" | "status" | "internal_notes" | "external_notes";
        block_order: number;
        content: any;
        is_internal: boolean;
      }> = [
        {
          slide_id: slide.id,
          block_type: "status",
          block_order: 0,
          content: {},
          is_internal: false,
        },
        {
          slide_id: slide.id,
          block_type: "content_meta",
          block_order: 1,
          content: {
            title: "",
            copywriting: "",
            caption: "",
            format: "feed",
            channel: "instagram",
          },
          is_internal: false,
        },
        {
          slide_id: slide.id,
          block_type: "image",
          block_order: 2,
          content: { images: [] },
          is_internal: false,
        },
      ];

      await supabase.from("slide_blocks").insert(defaultBlocks);
      return slide;
    },
    onSuccess: () => {
      refetchSlides();
      toast.success("Slide baru ditambahkan");
      setCurrentSlideIndex((slides?.length || 0));
    },
    onError: () => {
      toast.error("Gagal menambah slide");
    },
  });

  // Delete slide mutation
  const deleteSlideMutation = useMutation({
    mutationFn: async (slideId: string) => {
      const { error } = await supabase
        .from("editorial_slides")
        .delete()
        .eq("id", slideId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSlides();
      toast.success("Slide dihapus");
      if (currentSlideIndex > 0) {
        setCurrentSlideIndex(currentSlideIndex - 1);
      }
    },
    onError: () => {
      toast.error("Gagal menghapus slide");
    },
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowLeft" && currentSlideIndex > 0) {
        setCurrentSlideIndex(currentSlideIndex - 1);
      } else if (e.key === "ArrowRight" && slides && currentSlideIndex < slides.length - 1) {
        setCurrentSlideIndex(currentSlideIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, slides]);

  if (epLoading || slidesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!ep) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">EP tidak ditemukan</h2>
          <Button onClick={() => navigate("/editorial-plan")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  const getClientSlug = () => {
    return ep.clients?.name.toLowerCase().replace(/\s+/g, "-") || clientSlug;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/editorial-plan")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{ep.title}</h1>
              <p className="text-sm text-muted-foreground">
                {ep.clients?.name} {ep.period && `• ${ep.period}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://ms.talco.id/ep/${getClientSlug()}/${ep.slug}`, "_blank")}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Slide Navigation */}
          <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2 overflow-x-auto">
            {slides?.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setCurrentSlideIndex(index)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors shrink-0",
                  currentSlideIndex === index
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <GripVertical className="h-3 w-3 opacity-50" />
                <span>Slide {index + 1}</span>
                <SlideStatusBadge status={slide.status} size="sm" />
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addSlideMutation.mutate()}
              disabled={addSlideMutation.isPending}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Slide
            </Button>
          </div>

          {/* Current Slide Editor */}
          <div className="flex-1 relative">
            {currentSlide ? (
              <SlideEditor
                slide={currentSlide}
                epId={ep.id}
                isEditable={currentSlide.status !== "published"}
                onStatusChange={() => refetchSlides()}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">Belum ada slide</p>
                  <Button onClick={() => addSlideMutation.mutate()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Slide Pertama
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Navigation */}
          {slides && slides.length > 0 && (
            <div className="border-t bg-card px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                  disabled={currentSlideIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {currentSlideIndex + 1} / {slides.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
                  disabled={currentSlideIndex === slides.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {currentSlide && slides.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Hapus slide ini?")) {
                      deleteSlideMutation.mutate(currentSlide.id);
                    }
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus Slide
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Comments Panel */}
        {showComments && ep && (
          <EPCommentsPanel
            epId={ep.id}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>
    </div>
  );
}
