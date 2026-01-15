import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { usePositions } from "@/hooks/usePositions";

interface CreateRecruitmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function CreateRecruitmentFormDialog({
  open,
  onOpenChange,
}: CreateRecruitmentFormDialogProps) {
  const queryClient = useQueryClient();
  const { data: positions } = usePositions();
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    description: "",
    slug: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Generate unique slug
      let slug = formData.slug || generateSlug(formData.name);
      const timestamp = Date.now().toString(36);
      slug = `${slug}-${timestamp}`;

      const { data, error } = await supabase
        .from("recruitment_forms")
        .insert({
          name: formData.name,
          position: formData.position,
          description: formData.description || null,
          slug,
          created_by: session.session.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default fields for the form
      const defaultFields = [
        { field_type: 'short_text', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap Anda', is_required: true, field_order: 0 },
        { field_type: 'email', label: 'Email', placeholder: 'email@example.com', is_required: true, field_order: 1 },
        { field_type: 'phone', label: 'Nomor HP', placeholder: '08xxxxxxxxxx', is_required: true, field_order: 2 },
        { field_type: 'file', label: 'Upload CV', helper_text: 'Format: PDF, DOC, DOCX (Max 5MB)', is_required: true, field_order: 3 },
      ];

      const { error: fieldsError } = await supabase
        .from("recruitment_form_fields")
        .insert(defaultFields.map(field => ({ ...field, form_id: data.id })));

      if (fieldsError) throw fieldsError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-forms"] });
      toast.success("Form berhasil dibuat!");
      onOpenChange(false);
      setFormData({ name: "", position: "", description: "", slug: "" });
    },
    onError: (error) => {
      toast.error("Gagal membuat form: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.position) {
      toast.error("Nama dan posisi wajib diisi");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Buat Form Rekrutmen Baru</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Form *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  name: e.target.value,
                  slug: generateSlug(e.target.value),
                });
              }}
              placeholder="Contoh: Lowongan Graphic Designer 2024"
              className="h-12 sm:h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Posisi yang Dilamar *</Label>
            <Select
              value={formData.position}
              onValueChange={(value) => setFormData({ ...formData, position: value })}
            >
              <SelectTrigger className="h-12 sm:h-10">
                <SelectValue placeholder="Pilih posisi" />
              </SelectTrigger>
              <SelectContent>
                {positions?.map((pos) => (
                  <SelectItem key={pos.id} value={pos.name}>
                    {pos.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi Posisi (Opsional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Deskripsi singkat tentang posisi ini..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug (Auto-generated)</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: generateSlug(e.target.value) })}
              placeholder="lowongan-graphic-designer-2024"
              className="h-12 sm:h-10"
            />
            <p className="text-xs text-muted-foreground">
              Form akan tersedia di: /apply/{formData.slug || "..."}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Membuat..." : "Buat Form"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
