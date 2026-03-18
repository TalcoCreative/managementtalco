import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  MessageSquare,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SlideEditor } from "@/components/editorial-plan/SlideEditor";
import { SlideStatusBadge } from "@/components/editorial-plan/SlideStatusBadge";
import { EPCommentsPanel } from "@/components/editorial-plan/EPCommentsPanel";
import { EPCalendarView } from "@/components/editorial-plan/EPCalendarView";

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
  const [searchParams] = useSearchParams();
  const slideSlugParam = searchParams.get("slide");
  const queryClient = useQueryClient();
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [initialSlideResolved, setInitialSlideResolved] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const slideTabsRef = useRef<HTMLDivElement>(null);

  // Fetch EP data
  const { data: ep, isLoading: epLoading } = useQuery({
    queryKey: ["editorial-plan", clientSlug, epSlug],
    queryFn: async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name");
      
      const matchedClient = clients?.find(c => 
        c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") === clientSlug
      );

      let query = supabase
        .from("editorial_plans")
        .select(`*, clients(id, name)`)
        .eq("slug", epSlug);

      if (matchedClient) {
        query = query.eq("client_id", matchedClient.id);
      }

      const { data, error } = await query.single();
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

  const currentSlide = currentSlideIndex !== null ? slides?.[currentSlideIndex] : undefined;

  // Resolve ?slide=slug to index
  useEffect(() => {
    if (initialSlideResolved || !slides || slides.length === 0 || !slideSlugParam) return;
    const idx = slides.findIndex((s) => s.slug === slideSlugParam);
    if (idx >= 0) {
      setCurrentSlideIndex(idx);
    }
    setInitialSlideResolved(true);
  }, [slides, slideSlugParam, initialSlideResolved]);

  // Scroll active tab into view
  useEffect(() => {
    if (currentSlideIndex === null || !slideTabsRef.current) return;
    const activeBtn = slideTabsRef.current.children[currentSlideIndex + 2] as HTMLElement; // +2 for jadwal btn + divider
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentSlideIndex]);

  // Add slide mutation
  const addSlideMutation = useMutation({
    mutationFn: async () => {
      if (!ep?.id) throw new Error("No EP");

      const newOrder = (slides?.length || 0);
      const slug = `slide-${newOrder + 1}`;
      const { data: slide, error } = await supabase
        .from("editorial_slides")
        .insert({
          ep_id: ep.id,
          slide_order: newOrder,
          status: "proposed",
          slug,
          channels: [],
          publish_links: [],
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      const defaultBlocks: Array<{
        slide_id: string;
        block_type: "content_meta" | "image" | "video" | "status" | "internal_notes" | "external_notes";
        block_order: number;
        content: any;
        is_internal: boolean;
      }> = [
        { slide_id: slide.id, block_type: "status", block_order: 0, content: {}, is_internal: false },
        { slide_id: slide.id, block_type: "content_meta", block_order: 1, content: { title: "", copywriting: "", caption: "", format: "feed", channel: "instagram" }, is_internal: false },
        { slide_id: slide.id, block_type: "image", block_order: 2, content: { images: [] }, is_internal: false },
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
      if (currentSlideIndex !== null && currentSlideIndex > 0) {
        setCurrentSlideIndex(currentSlideIndex - 1);
      }
    },
    onError: () => {
      toast.error("Gagal menghapus slide");
    },
  });

  // Keyboard navigation - skip when lightbox is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowLeft") {
        if (currentSlideIndex === null) return;
        if (currentSlideIndex === 0) setCurrentSlideIndex(null);
        else setCurrentSlideIndex(currentSlideIndex - 1);
      } else if (e.key === "ArrowRight") {
        if (currentSlideIndex === null && slides && slides.length > 0) {
          setCurrentSlideIndex(0);
        } else if (currentSlideIndex !== null && slides && currentSlideIndex < slides.length - 1) {
          setCurrentSlideIndex(currentSlideIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, slides, lightboxOpen]);

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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header - fixed */}
      <header className="border-b bg-card px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/editorial-plan")}>
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
            <Button variant="outline" size="sm" onClick={() => setShowComments(!showComments)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`https://ms.talco.id/ep/${getClientSlug()}/${ep.slug}`, "_blank")}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Slide Navigation - fixed, scrollable */}
          <div
            ref={slideTabsRef}
            className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-thin"
            style={{ scrollbarWidth: "thin" }}
          >
            <button
              onClick={() => setCurrentSlideIndex(null)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors shrink-0 font-medium",
                currentSlideIndex === null
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              Jadwal
            </button>
            <div className="w-px h-6 bg-border shrink-0" />
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
                <div className="flex flex-col items-start">
                  <span>Slide {index + 1}</span>
                  {slide.publish_date && (
                    <span className="text-[10px] opacity-70">
                      {new Date(slide.publish_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
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

          {/* Content area - scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {currentSlideIndex === null ? (
              <div className="p-4">
                {slides && slides.length > 0 ? (
                  <EPCalendarView
                    slides={slides}
                    onSlideClick={(index) => setCurrentSlideIndex(index)}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center py-20">
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
            ) : currentSlide ? (
              <SlideEditor
                slide={currentSlide}
                epId={ep.id}
                isEditable={true}
                onStatusChange={() => refetchSlides()}
                onLightboxChange={setLightboxOpen}
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

          {/* Bottom Navigation - fixed at bottom */}
          {slides && slides.length > 0 && currentSlideIndex !== null && (
            <div className="border-t bg-card px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentSlideIndex === 0) setCurrentSlideIndex(null);
                    else setCurrentSlideIndex(currentSlideIndex - 1);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {currentSlideIndex === 0 ? "Jadwal" : "Previous"}
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
            epTitle={ep.title}
            currentSlideId={currentSlide?.id}
            currentSlideLabel={currentSlide ? `Slide ${(currentSlideIndex ?? 0) + 1}` : undefined}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>
    </div>
  );
}