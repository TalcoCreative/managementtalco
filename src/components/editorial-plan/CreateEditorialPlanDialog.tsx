import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CreateEditorialPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultClientId?: string;
}

export function CreateEditorialPlanDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultClientId,
}: CreateEditorialPlanDialogProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    clientId: defaultClientId || "",
    period: "",
    slug: "",
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-for-ep-dialog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-ep"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.clientId || !currentUser) {
      toast.error("Lengkapi semua field yang diperlukan");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the editorial plan
      const { data: ep, error: epError } = await supabase
        .from("editorial_plans")
        .insert({
          title: formData.title,
          client_id: formData.clientId,
          slug: formData.slug || generateSlug(formData.title),
          period: formData.period || null,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (epError) {
        if (epError.message.includes("duplicate")) {
          toast.error("Slug sudah digunakan untuk client ini");
        } else {
          throw epError;
        }
        return;
      }

      // Create first slide with default blocks
      const { data: slide, error: slideError } = await supabase
        .from("editorial_slides")
        .insert({
          ep_id: ep.id,
          slide_order: 0,
          status: "proposed",
        })
        .select()
        .single();

      if (slideError) throw slideError;

      // Create default blocks for the first slide
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

      toast.success("Editorial Plan berhasil dibuat");
      
      // Get client slug for navigation
      const client = clients?.find(c => c.id === formData.clientId);
      const clientSlug = client?.name.toLowerCase().replace(/\s+/g, "-") || "client";
      
      onSuccess();
      navigate(`/ep/${clientSlug}/${ep.slug}/edit`);
    } catch (error: any) {
      console.error("Error creating EP:", error);
      toast.error("Gagal membuat EP");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Editorial Plan Baru</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select
              value={formData.clientId}
              onValueChange={(value) => setFormData({ ...formData, clientId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Judul EP *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Contoh: Ramadan Campaign 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Periode</Label>
            <Input
              id="period"
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              placeholder="Contoh: 2026-01 atau Q1 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug URL</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="akan-di-generate-otomatis"
            />
            <p className="text-xs text-muted-foreground">
              URL: /ep/[client-slug]/{formData.slug || "..."}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Membuat..." : "Buat EP"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
