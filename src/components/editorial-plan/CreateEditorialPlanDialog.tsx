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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  const [projectMode, setProjectMode] = useState<"auto" | "existing">("auto");
  const [existingProjectId, setExistingProjectId] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    clientId: defaultClientId || "",
    period: "",
    periodStart: "",
    periodEnd: "",
    slug: "",
  });

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

  const { data: existingProjects } = useQuery({
    queryKey: ["projects-for-ep-dialog", formData.clientId],
    enabled: !!formData.clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .eq("client_id", formData.clientId)
        .order("title");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-ep"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const generateSlug = (title: string) => {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const suffix = Date.now().toString(36).slice(-4);
    return `${base}-${suffix}`;
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
    if (projectMode === "existing" && !existingProjectId) {
      toast.error("Pilih project yang sudah ada");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Determine project
      let projectId: string | null = null;
      if (projectMode === "existing") {
        projectId = existingProjectId;
      } else {
        // Auto-create project with EP title + period range as deadline
        const projectTitle = formData.period
          ? `EP ${formData.title} (${formData.period})`
          : `EP ${formData.title}`;

        const { data: project, error: projError } = await supabase
          .from("projects")
          .insert({
            title: projectTitle,
            description: `Auto-generated from Editorial Plan: ${formData.title}`,
            type: "Editorial Plan",
            client_id: formData.clientId,
            deadline: formData.periodEnd || null,
            status: "in_progress",
          } as any)
          .select()
          .single();
        if (projError) throw projError;
        projectId = project.id;
      }

      // 2. Create the editorial plan
      const { data: ep, error: epError } = await supabase
        .from("editorial_plans")
        .insert({
          title: formData.title,
          client_id: formData.clientId,
          slug: formData.slug || generateSlug(formData.title),
          period: formData.period || null,
          period_start: formData.periodStart || null,
          period_end: formData.periodEnd || null,
          project_id: projectId,
          created_by: currentUser.id,
        } as any)
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

      // 3. Create first slide with default blocks
      const { data: slide, error: slideError } = await supabase
        .from("editorial_slides")
        .insert({
          ep_id: ep.id,
          slide_order: 0,
          status: "proposed",
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (slideError) throw slideError;

      const defaultBlocks: Array<{
        slide_id: string;
        block_type: "content_meta" | "image" | "video" | "status" | "internal_notes" | "external_notes";
        block_order: number;
        content: any;
        is_internal: boolean;
      }> = [
        { slide_id: slide.id, block_type: "status", block_order: 0, content: {}, is_internal: false },
        {
          slide_id: slide.id,
          block_type: "content_meta",
          block_order: 1,
          content: { title: "", copywriting: "", caption: "", format: "feed", channel: "instagram" },
          is_internal: false,
        },
        { slide_id: slide.id, block_type: "image", block_order: 2, content: { images: [] }, is_internal: false },
      ];

      await supabase.from("slide_blocks").insert(defaultBlocks);

      toast.success("Editorial Plan & Project berhasil dibuat");

      const client = clients?.find((c) => c.id === formData.clientId);
      const clientSlug =
        client?.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "client";

      onSuccess();
      navigate(`/ep/${clientSlug}/${ep.slug}/edit`);
    } catch (error: any) {
      console.error("Error creating EP:", error);
      toast.error(error.message || "Gagal membuat EP");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Editorial Plan Baru</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <SearchableSelect
              options={(clients || []).map((c) => ({ value: c.id, label: c.name }))}
              value={formData.clientId}
              onValueChange={(value) => setFormData({ ...formData, clientId: value })}
              placeholder="Pilih client"
              searchPlaceholder="Cari client..."
            />
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Periode Mulai</Label>
              <Input
                id="periodStart"
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Periode Selesai</Label>
              <Input
                id="periodEnd"
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Label Periode</Label>
            <Input
              id="period"
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              placeholder="Contoh: 2026-01 atau Q1 2026"
            />
          </div>

          {/* Project linkage */}
          <div className="space-y-2 rounded-xl border border-border/60 p-3">
            <Label>Project untuk EP ini</Label>
            <RadioGroup value={projectMode} onValueChange={(v) => setProjectMode(v as any)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="auto" />
                <Label htmlFor="auto" className="font-normal cursor-pointer text-sm">
                  Auto-create project baru (judul = "EP {formData.title || '...'}")
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="existing" id="existing" disabled={!formData.clientId} />
                <Label htmlFor="existing" className="font-normal cursor-pointer text-sm">
                  Pilih project yang sudah ada
                </Label>
              </div>
            </RadioGroup>
            {projectMode === "existing" && (
              <SearchableSelect
                options={(existingProjects || []).map((p) => ({ value: p.id, label: p.title }))}
                value={existingProjectId}
                onValueChange={setExistingProjectId}
                placeholder="Pilih project existing"
                searchPlaceholder="Cari project..."
              />
            )}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
