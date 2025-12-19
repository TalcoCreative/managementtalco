import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

const ENTITIES = [
  { code: "TCI", name: "Talco Creative Indonesia" },
  { code: "TS", name: "Talco Studio" },
  { code: "TW", name: "Talco World" },
];

const CATEGORIES = [
  { code: "HR", name: "HR" },
  { code: "FIN", name: "Finance" },
  { code: "ADM", name: "Admin" },
  { code: "MKT", name: "Marketing" },
  { code: "PRJ", name: "Project" },
  { code: "GEN", name: "General" },
];

interface CreateLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateLetterDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateLetterDialogProps) {
  const [entityCode, setEntityCode] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [projectLabel, setProjectLabel] = useState("");
  const [projectId, setProjectId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ["projects-for-letters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user profile - profiles.id is the auth user id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      // Get next running number
      const { data: nextNumber, error: numError } = await supabase
        .rpc("get_next_letter_number", {
          p_entity_code: entityCode,
          p_category_code: categoryCode,
          p_year: year,
          p_month: month,
        });

      if (numError) throw numError;

      // Generate letter number
      const label = projectLabel || "GENERAL";
      const monthStr = month.toString().padStart(2, "0");
      const runningStr = nextNumber.toString().padStart(3, "0");
      const letterNumber = `${entityCode}/${categoryCode}/${label.toUpperCase()}/${monthStr}/${year}/${runningStr}`;

      const entity = ENTITIES.find(e => e.code === entityCode);
      const category = CATEGORIES.find(c => c.code === categoryCode);

      const { data, error } = await supabase.from("letters").insert({
        letter_number: letterNumber,
        entity_code: entityCode,
        entity_name: entity?.name || "",
        category_code: categoryCode,
        category_name: category?.name || "",
        project_label: projectLabel || null,
        project_id: projectId || null,
        recipient_name: recipientName,
        recipient_company: recipientCompany || null,
        notes: notes || null,
        created_by: profile.id,
        running_number: nextNumber,
        year,
        month,
        status: "draft",
        is_confidential: isConfidential,
      }).select().single();

      if (error) throw error;

      // Log activity
      await supabase.from("letter_activity_logs").insert({
        letter_id: data.id,
        action: "created",
        new_value: `Surat dibuat dengan nomor ${letterNumber}${isConfidential ? " (Rahasia)" : ""}`,
        changed_by: profile.id,
      });

      return data;
    },
    onSuccess: () => {
      toast.success("Surat berhasil dibuat!");
      resetForm();
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Gagal membuat surat");
    },
  });

  const resetForm = () => {
    setEntityCode("");
    setCategoryCode("");
    setProjectLabel("");
    setProjectId("");
    setRecipientName("");
    setRecipientCompany("");
    setNotes("");
    setIsConfidential(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityCode || !categoryCode || !recipientName) {
      toast.error("Lengkapi field yang wajib diisi");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Surat Baru</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Entitas *</Label>
            <Select value={entityCode} onValueChange={setEntityCode}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih entitas" />
              </SelectTrigger>
              <SelectContent>
                {ENTITIES.map(entity => (
                  <SelectItem key={entity.code} value={entity.code}>
                    {entity.code} - {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kategori Surat *</Label>
            <Select value={categoryCode} onValueChange={setCategoryCode}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.code} value={cat.code}>
                    {cat.code} - {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Project Terkait (Opsional)</Label>
            <Select value={projectId} onValueChange={(val) => setProjectId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                {projects?.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Label / Campaign (Opsional)</Label>
            <Input
              placeholder="Contoh: TAMARA, REELS2025"
              value={projectLabel}
              onChange={(e) => setProjectLabel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Akan digunakan dalam nomor surat. Jika kosong, akan menggunakan "GENERAL"
            </p>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">Data Penerima</h4>
            
            <div className="space-y-2">
              <Label>Nama Penerima *</Label>
              <Input
                placeholder="Nama penerima surat"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Perusahaan / Instansi</Label>
              <Input
                placeholder="Perusahaan penerima"
                value={recipientCompany}
                onChange={(e) => setRecipientCompany(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              placeholder="Catatan tambahan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Confidential Toggle */}
          <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
            <Checkbox
              id="confidential"
              checked={isConfidential}
              onCheckedChange={(checked) => setIsConfidential(checked as boolean)}
            />
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-500" />
              <Label htmlFor="confidential" className="text-sm cursor-pointer">
                Surat Rahasia (hanya pembuat & Super Admin yang bisa lihat)
              </Label>
            </div>
          </div>

          {entityCode && categoryCode && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Preview nomor surat:</p>
              <p className="font-mono font-medium">
                {entityCode}/{categoryCode}/{(projectLabel || "GENERAL").toUpperCase()}/
                {(new Date().getMonth() + 1).toString().padStart(2, "0")}/
                {new Date().getFullYear()}/XXX
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Buat Surat
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
