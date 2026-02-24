import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { usePositions } from "@/hooks/usePositions";

interface EditRecruitmentFormDialogProps {
  formId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditRecruitmentFormDialog({
  formId,
  open,
  onOpenChange,
}: EditRecruitmentFormDialogProps) {
  const queryClient = useQueryClient();
  const { data: positions } = usePositions();
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    description: "",
  });

  const { data: form } = useQuery({
    queryKey: ["recruitment-form-detail", formId],
    queryFn: async () => {
      if (!formId) return null;
      const { data, error } = await supabase
        .from("recruitment_forms")
        .select("*")
        .eq("id", formId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  useEffect(() => {
    if (form) {
      setFormData({
        name: form.name,
        position: form.position,
        description: form.description || "",
      });
    }
  }, [form]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!formId) throw new Error("No form ID");
      const { error } = await supabase
        .from("recruitment_forms")
        .update({
          name: formData.name,
          position: formData.position,
          description: formData.description || null,
        })
        .eq("id", formId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-forms"] });
      toast.success("Form berhasil diperbarui!");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Gagal memperbarui form: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.position) {
      toast.error("Nama dan posisi wajib diisi");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Form Rekrutmen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nama Form *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-12 sm:h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-position">Posisi yang Dilamar *</Label>
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
            <Label htmlFor="edit-description">Deskripsi Posisi (Opsional)</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
