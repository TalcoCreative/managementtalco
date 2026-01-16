import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MessageSquare,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SlideStatusBadge } from "@/components/editorial-plan/SlideStatusBadge";
import { PublicSlideView } from "@/components/editorial-plan/PublicSlideView";
import { PublicCommentsPanel } from "@/components/editorial-plan/PublicCommentsPanel";

interface Slide {
  id: string;
  ep_id: string;
  slide_order: number;
  status: "proposed" | "approved" | "published";
  approved_at: string | null;
  published_at: string | null;
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

export default function PublicEditorialPlan() {
  const { clientSlug, epSlug } = useParams();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Fetch EP data
  const { data: ep, isLoading: epLoading } = useQuery({
    queryKey: ["public-editorial-plan", clientSlug, epSlug],
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
    queryKey: ["public-editorial-slides", ep?.id],
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

  const handleApprove = async () => {
    if (!currentSlide || currentSlide.status !== "proposed") return;

    setIsApproving(true);
    try {
      const { error } = await supabase
        .from("editorial_slides")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", currentSlide.id);

      if (error) throw error;

      // Log activity
      await supabase.from("ep_activity_logs").insert({
        ep_id: ep?.id,
        slide_id: currentSlide.id,
        action: "slide_approved",
        actor_name: "Client",
        details: { slide_order: currentSlide.slide_order + 1 },
      });

      toast.success("Content approved!");
      refetchSlides();
    } catch (error) {
      console.error("Error approving slide:", error);
      toast.error("Failed to approve");
    } finally {
      setIsApproving(false);
    }
  };

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
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Editorial Plan tidak ditemukan</h2>
          <p className="text-muted-foreground">
            Link mungkin sudah tidak valid atau EP telah dihapus
          </p>
        </div>
      </div>
    );
  }

  // Calculate approval stats
  const approvedCount = slides?.filter(s => s.status === "approved" || s.status === "published").length || 0;
  const totalSlides = slides?.length || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{ep.clients?.name}</Badge>
              {ep.period && <Badge variant="secondary">{ep.period}</Badge>}
            </div>
            <h1 className="text-xl font-semibold">{ep.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              {approvedCount}/{totalSlides} Approved
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments
            </Button>
          </div>
        </div>
      </header>

      {/* Slide Thumbnails */}
      <div className="border-b bg-muted/30 px-4 py-3 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          {slides?.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlideIndex(index)}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors shrink-0 min-w-[80px]",
                currentSlideIndex === index
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted border"
              )}
            >
              <span className="text-sm font-medium">{index + 1}</span>
              <SlideStatusBadge 
                status={slide.status} 
                size="sm" 
                variant={currentSlideIndex === index ? "light" : "default"}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Current Slide View */}
          <div className="flex-1 overflow-auto">
            {currentSlide ? (
              <PublicSlideView slide={currentSlide} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">Tidak ada content</p>
              </div>
            )}
          </div>

          {/* Bottom Navigation */}
          {slides && slides.length > 0 && (
            <div className="border-t bg-card px-4 py-4">
              <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                    disabled={currentSlideIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-4">
                    Slide {currentSlideIndex + 1} of {slides.length}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
                    disabled={currentSlideIndex === slides.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Approve Button */}
                {currentSlide?.status === "proposed" && (
                  <Button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isApproving ? "Approving..." : "Approve This Content"}
                  </Button>
                )}

                {currentSlide?.status === "approved" && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Approved
                  </Badge>
                )}

                {currentSlide?.status === "published" && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    Published
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Comments Panel */}
        {showComments && ep && (
          <PublicCommentsPanel
            epId={ep.id}
            currentSlideId={currentSlide?.id}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>
    </div>
  );
}
