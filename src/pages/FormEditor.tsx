import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, GripVertical, Trash2, Eye, Copy, ExternalLink, Save,
} from "lucide-react";
import { toast } from "sonner";

const FIELD_TYPES = [
  { value: "short_text", label: "Teks Singkat" },
  { value: "long_text", label: "Teks Panjang" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Nomor HP" },
  { value: "number", label: "Angka" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multiple_choice", label: "Pilihan Ganda" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "Upload File" },
  { value: "date", label: "Tanggal" },
];

interface Question {
  id: string;
  label: string;
  field_type: string;
  is_required: boolean;
  field_order: number;
  options: string[] | null;
  placeholder: string | null;
  _isNew?: boolean;
  _isDeleted?: boolean;
}

export default function FormEditor() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleteQ, setDeleteQ] = useState<Question | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const { data: form } = useQuery({
    queryKey: ["form-detail", formId],
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("*").eq("id", formId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  useQuery({
    queryKey: ["form-questions", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_questions")
        .select("*")
        .eq("form_id", formId!)
        .order("field_order");
      if (error) throw error;
      setQuestions((data || []).map((q: any) => ({
        ...q,
        options: q.options as string[] | null,
      })));
      setLoaded(true);
      return data;
    },
    enabled: !!formId && !loaded,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toDelete = questions.filter(q => q._isDeleted && !q._isNew);
      const toCreate = questions.filter(q => q._isNew && !q._isDeleted);
      const toUpdate = questions.filter(q => !q._isNew && !q._isDeleted);

      // Delete
      for (const q of toDelete) {
        await supabase.from("form_questions").delete().eq("id", q.id);
      }

      // Update
      for (const q of toUpdate) {
        await supabase.from("form_questions").update({
          label: q.label,
          field_type: q.field_type,
          is_required: q.is_required,
          field_order: q.field_order,
          options: q.options,
          placeholder: q.placeholder,
        }).eq("id", q.id);
      }

      // Create
      if (toCreate.length > 0) {
        await supabase.from("form_questions").insert(
          toCreate.map(q => ({
            form_id: formId!,
            label: q.label,
            field_type: q.field_type,
            is_required: q.is_required,
            field_order: q.field_order,
            options: q.options,
            placeholder: q.placeholder,
          }))
        );
      }
    },
    onSuccess: () => {
      setLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["form-questions", formId] });
      toast.success("Pertanyaan disimpan");
    },
    onError: (e) => toast.error("Gagal menyimpan: " + e.message),
  });

  const addQuestion = () => {
    const active = questions.filter(q => !q._isDeleted);
    setQuestions([...questions, {
      id: crypto.randomUUID(),
      label: "",
      field_type: "short_text",
      is_required: false,
      field_order: active.length,
      options: null,
      placeholder: null,
      _isNew: true,
    }]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const markDelete = (q: Question) => {
    if (q._isNew) {
      setQuestions(qs => qs.filter(x => x.id !== q.id));
    } else {
      updateQuestion(q.id, { _isDeleted: true });
    }
    setDeleteQ(null);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const active = questions.filter(q => !q._isDeleted);
    const newList = [...active];
    const [moved] = newList.splice(dragIdx, 1);
    newList.splice(idx, 0, moved);
    const reordered = newList.map((q, i) => ({ ...q, field_order: i }));
    const deleted = questions.filter(q => q._isDeleted);
    setQuestions([...reordered, ...deleted]);
    setDragIdx(idx);
  };

  const activeQuestions = questions.filter(q => !q._isDeleted);
  const needsOptions = (type: string) => ["dropdown", "multiple_choice", "checkbox"].includes(type);

  const copyLink = () => {
    if (form) {
      navigator.clipboard.writeText(`https://ms.talco.id/forms/${form.slug}`);
      toast.success("Link disalin!");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/forms")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{form?.name || "..."}</h1>
              <p className="text-muted-foreground text-sm">{form?.description || "Edit pertanyaan form"}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {form?.is_public && (
              <>
                <Button variant="outline" size="sm" onClick={() => window.open(`/f/${form.slug}`, '_blank')}>
                  <Eye className="mr-2 h-4 w-4" />Preview
                </Button>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="mr-2 h-4 w-4" />Link
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${formId}/responses`)}>
              Respons
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />Simpan
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {activeQuestions.map((q, idx) => (
            <Card
              key={q.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={() => setDragIdx(null)}
              className={dragIdx === idx ? "opacity-50" : ""}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="cursor-grab pt-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-2 flex-col sm:flex-row">
                      <Input
                        value={q.label}
                        onChange={e => updateQuestion(q.id, { label: e.target.value })}
                        placeholder="Pertanyaan..."
                        className="flex-1"
                      />
                      <Select value={q.field_type} onValueChange={v => updateQuestion(q.id, { field_type: v, options: needsOptions(v) ? (q.options || ["Opsi 1"]) : null })}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {needsOptions(q.field_type) && (
                      <div className="space-y-2 pl-4 border-l-2 border-muted">
                        <Label className="text-xs text-muted-foreground">Pilihan (satu per baris)</Label>
                        <Textarea
                          value={(q.options || []).join("\n")}
                          onChange={e => updateQuestion(q.id, { options: e.target.value.split("\n").filter(Boolean) })}
                          placeholder={"Opsi 1\nOpsi 2\nOpsi 3"}
                          rows={3}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={q.is_required}
                          onCheckedChange={v => updateQuestion(q.id, { is_required: v })}
                        />
                        <Label className="text-sm">Wajib</Label>
                      </div>
                      <Input
                        value={q.placeholder || ""}
                        onChange={e => updateQuestion(q.id, { placeholder: e.target.value })}
                        placeholder="Placeholder (opsional)"
                        className="flex-1 text-sm"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteQ(q)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full border-dashed" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" />Tambah Pertanyaan
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteQ} onOpenChange={o => !o && setDeleteQ(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pertanyaan?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteQ?.label}" akan dihapus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteQ && markDelete(deleteQ)} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
