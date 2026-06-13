import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, GripVertical, Trash2, Eye, Copy, Save, Palette, SeparatorHorizontal,
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

const PRESET_THEMES: { name: string; primary: string; bg: string; text: string }[] = [
  { name: "Indigo Light", primary: "#6366f1", bg: "#ffffff", text: "#0f172a" },
  { name: "Midnight", primary: "#a78bfa", bg: "#0b0b14", text: "#f8fafc" },
  { name: "Emerald", primary: "#10b981", bg: "#f8fafc", text: "#0f172a" },
  { name: "Sunset", primary: "#f97316", bg: "#fff7ed", text: "#1c1917" },
  { name: "Rose Noir", primary: "#fb7185", bg: "#0c0a1a", text: "#fce7f3" },
  { name: "Paper", primary: "#0f172a", bg: "#f5f3ee", text: "#0f172a" },
];

interface Question {
  id: string;
  label: string;
  field_type: string;
  is_required: boolean;
  field_order: number;
  options: string[] | null;
  placeholder: string | null;
  description?: string | null;
  is_section_break?: boolean | null;
  section_title?: string | null;
  section_description?: string | null;
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

  // Form design state
  const [design, setDesign] = useState<any>(null);

  const { data: form } = useQuery({
    queryKey: ["form-detail", formId],
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("*").eq("id", formId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  useEffect(() => {
    if (form && !design) setDesign(form);
  }, [form, design]);

  useQuery({
    queryKey: ["form-questions", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_questions")
        .select("*")
        .eq("form_id", formId!)
        .order("field_order");
      if (error) throw error;
      setQuestions((data || []).map((q: any) => ({ ...q, options: q.options as string[] | null })));
      setLoaded(true);
      return data;
    },
    enabled: !!formId && !loaded,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save form design
      if (design) {
        const { error: fErr } = await supabase.from("forms").update({
          primary_color: design.primary_color,
          background_color: design.background_color,
          text_color: design.text_color,
          background_image: design.background_image,
          button_label: design.button_label,
          submit_label: design.submit_label,
          thank_you_title: design.thank_you_title,
          thank_you_message: design.thank_you_message,
          thank_you_image: design.thank_you_image,
          layout_size: design.layout_size,
          show_progress: design.show_progress,
          one_question_per_page: design.one_question_per_page,
          font_family: design.font_family,
          description: design.description,
        }).eq("id", formId!);
        if (fErr) throw fErr;
      }

      const toDelete = questions.filter(q => q._isDeleted && !q._isNew);
      const toCreate = questions.filter(q => q._isNew && !q._isDeleted);
      const toUpdate = questions.filter(q => !q._isNew && !q._isDeleted);

      for (const q of toDelete) {
        await supabase.from("form_questions").delete().eq("id", q.id);
      }

      for (const q of toUpdate) {
        await supabase.from("form_questions").update({
          label: q.label,
          field_type: q.field_type,
          is_required: q.is_required,
          field_order: q.field_order,
          options: q.options,
          placeholder: q.placeholder,
          description: q.description,
          is_section_break: q.is_section_break,
          section_title: q.section_title,
          section_description: q.section_description,
        }).eq("id", q.id);
      }

      if (toCreate.length > 0) {
        await supabase.from("form_questions").insert(
          toCreate.map(q => ({
            form_id: formId!,
            label: q.label || (q.is_section_break ? "Bagian" : ""),
            field_type: q.field_type,
            is_required: q.is_required,
            field_order: q.field_order,
            options: q.options,
            placeholder: q.placeholder,
            description: q.description,
            is_section_break: q.is_section_break,
            section_title: q.section_title,
            section_description: q.section_description,
          }))
        );
      }
    },
    onSuccess: () => {
      setLoaded(false);
      queryClient.invalidateQueries({ queryKey: ["form-questions", formId] });
      queryClient.invalidateQueries({ queryKey: ["form-detail", formId] });
      toast.success("Tersimpan");
    },
    onError: (e: any) => toast.error("Gagal menyimpan: " + e.message),
  });

  const addQuestion = (isSection = false) => {
    const active = questions.filter(q => !q._isDeleted);
    setQuestions([...questions, {
      id: crypto.randomUUID(),
      label: isSection ? "Bagian baru" : "",
      field_type: isSection ? "section" : "short_text",
      is_required: false,
      field_order: active.length,
      options: null,
      placeholder: null,
      description: null,
      is_section_break: isSection,
      section_title: isSection ? "Bagian baru" : null,
      section_description: null,
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
      navigator.clipboard.writeText(`https://ms.talco.id/f/${form.slug}`);
      toast.success("Link disalin!");
    }
  };

  const setDesignField = (k: string, v: any) => setDesign((d: any) => ({ ...(d || {}), [k]: v }));

  const applyPreset = (p: typeof PRESET_THEMES[number]) => {
    setDesign((d: any) => ({ ...(d || {}), primary_color: p.primary, background_color: p.bg, text_color: p.text }));
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
              <p className="text-muted-foreground text-sm">{form?.description || "Edit pertanyaan & desain form"}</p>
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

        <Tabs defaultValue="questions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="questions">Pertanyaan</TabsTrigger>
            <TabsTrigger value="design"><Palette className="h-3.5 w-3.5 mr-1.5" />Desain</TabsTrigger>
            <TabsTrigger value="thankyou">Thank You</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-3">
            {activeQuestions.map((q, idx) => (
              <Card
                key={q.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={() => setDragIdx(null)}
                className={`${dragIdx === idx ? "opacity-50" : ""} ${q.is_section_break ? "border-primary/40 bg-primary/5" : ""}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="cursor-grab pt-2 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-3">
                      {q.is_section_break ? (
                        <>
                          <div className="flex items-center gap-2">
                            <SeparatorHorizontal className="h-4 w-4 text-primary" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Section Break</span>
                          </div>
                          <Input
                            value={q.section_title || ""}
                            onChange={e => updateQuestion(q.id, { section_title: e.target.value, label: e.target.value })}
                            placeholder="Judul bagian..."
                            className="text-base font-medium"
                          />
                          <Textarea
                            value={q.section_description || ""}
                            onChange={e => updateQuestion(q.id, { section_description: e.target.value })}
                            placeholder="Deskripsi singkat untuk bagian ini (opsional)"
                            rows={2}
                          />
                        </>
                      ) : (
                        <>
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

                          <Textarea
                            value={q.description || ""}
                            onChange={e => updateQuestion(q.id, { description: e.target.value })}
                            placeholder="Catatan / penjelasan untuk pertanyaan ini (opsional)"
                            rows={2}
                            className="text-sm"
                          />

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

                          <div className="flex items-center gap-4 flex-wrap">
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
                              className="flex-1 text-sm min-w-[200px]"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteQ(q)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="flex-1 border-dashed" onClick={() => addQuestion(false)}>
                <Plus className="mr-2 h-4 w-4" />Tambah Pertanyaan
              </Button>
              <Button variant="outline" className="flex-1 border-dashed" onClick={() => addQuestion(true)}>
                <SeparatorHorizontal className="mr-2 h-4 w-4" />Tambah Bagian (Next Page)
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="design" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Preset</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_THEMES.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className="rounded-xl border p-3 text-left hover:border-primary transition-all hover:-translate-y-0.5"
                        style={{ background: p.bg, color: p.text }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="h-5 w-5 rounded-md" style={{ background: p.primary }} />
                          <span className="text-xs font-medium">{p.name}</span>
                        </div>
                        <div className="text-[10px] opacity-70">Aa — Contoh</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Warna Utama</Label>
                    <div className="flex gap-2 mt-1">
                      <Input type="color" value={design?.primary_color || "#6366f1"} onChange={e => setDesignField("primary_color", e.target.value)} className="w-14 h-10 p-1" />
                      <Input value={design?.primary_color || ""} onChange={e => setDesignField("primary_color", e.target.value)} placeholder="#6366f1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Warna Background</Label>
                    <div className="flex gap-2 mt-1">
                      <Input type="color" value={design?.background_color || "#ffffff"} onChange={e => setDesignField("background_color", e.target.value)} className="w-14 h-10 p-1" />
                      <Input value={design?.background_color || ""} onChange={e => setDesignField("background_color", e.target.value)} placeholder="#ffffff" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Warna Teks (opsional)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input type="color" value={design?.text_color || "#0f172a"} onChange={e => setDesignField("text_color", e.target.value)} className="w-14 h-10 p-1" />
                      <Input value={design?.text_color || ""} onChange={e => setDesignField("text_color", e.target.value)} placeholder="auto" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Kosongkan untuk auto-adaptive</p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Background Image URL (opsional)</Label>
                  <Input value={design?.background_image || ""} onChange={e => setDesignField("background_image", e.target.value)} placeholder="https://... (kosongkan untuk solid)" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Ukuran Layout</Label>
                    <Select value={design?.layout_size || "medium"} onValueChange={v => setDesignField("layout_size", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Kecil (compact)</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Besar (immersive)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Font</Label>
                    <Select value={design?.font_family || "inter"} onValueChange={v => setDesignField("font_family", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inter">Inter (default)</SelectItem>
                        <SelectItem value="grotesk">Space Grotesk</SelectItem>
                        <SelectItem value="display">Sora (display)</SelectItem>
                        <SelectItem value="serif">Instrument Serif</SelectItem>
                        <SelectItem value="mono">JetBrains Mono</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Label Tombol "Next"</Label>
                    <Input value={design?.button_label || ""} onChange={e => setDesignField("button_label", e.target.value)} placeholder="OK" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    <Switch
                      checked={design?.show_progress !== false}
                      onCheckedChange={v => setDesignField("show_progress", v)}
                    />
                    <Label className="text-sm">Tampilkan progress bar</Label>
                  </div>
                  <div>
                    <Label className="text-xs">Label Tombol Submit</Label>
                    <Input value={design?.submit_label || ""} onChange={e => setDesignField("submit_label", e.target.value)} placeholder="Kirim" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Deskripsi / Welcome Message</Label>
                  <Textarea
                    value={design?.description || ""}
                    onChange={e => setDesignField("description", e.target.value)}
                    placeholder="Halo! Form ini hanya butuh 2 menit untuk diisi..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="thankyou">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs">Judul Thank-You</Label>
                  <Input value={design?.thank_you_title || ""} onChange={e => setDesignField("thank_you_title", e.target.value)} placeholder="Terima kasih!" />
                </div>
                <div>
                  <Label className="text-xs">Pesan Thank-You</Label>
                  <Textarea
                    value={design?.thank_you_message || ""}
                    onChange={e => setDesignField("thank_you_message", e.target.value)}
                    placeholder="Respons Anda berhasil dikirim. Tim kami akan menghubungi Anda segera."
                    rows={4}
                  />
                </div>
                <div>
                  <Label className="text-xs">Gambar Thank-You (URL, opsional)</Label>
                  <Input value={design?.thank_you_image || ""} onChange={e => setDesignField("thank_you_image", e.target.value)} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteQ} onOpenChange={o => !o && setDeleteQ(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteQ?.label || deleteQ?.section_title}" akan dihapus.</AlertDialogDescription>
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
