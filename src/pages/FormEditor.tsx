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
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft, Plus, GripVertical, Trash2, Eye, Copy, Save, Palette,
  SeparatorHorizontal, ChevronDown, Settings, Workflow,
} from "lucide-react";
import { toast } from "sonner";
import {
  FIELD_TYPES, CATEGORY_LABELS, getFieldDef, needsOptions, needsImageOptions,
  isDisplayBlock, type FieldCategory, type LogicRule,
} from "@/lib/form-fields";

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
  options: any;
  placeholder: string | null;
  description?: string | null;
  is_section_break?: boolean | null;
  section_title?: string | null;
  section_description?: string | null;
  config?: any;
  logic_rules?: LogicRule[] | null;
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

  useEffect(() => { if (form && !design) setDesign(form); }, [form, design]);

  useQuery({
    queryKey: ["form-questions", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_questions").select("*").eq("form_id", formId!).order("field_order");
      if (error) throw error;
      setQuestions((data || []).map((q: any) => ({
        ...q,
        options: q.options,
        config: q.config || {},
        logic_rules: (q.logic_rules as LogicRule[] | null) || [],
      })));
      setLoaded(true);
      return data;
    },
    enabled: !!formId && !loaded,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
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
          thank_you_redirect_url: design.thank_you_redirect_url,
          thank_you_redirect_delay: design.thank_you_redirect_delay,
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

      for (const q of toDelete) await supabase.from("form_questions").delete().eq("id", q.id);

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
          config: q.config || {},
          logic_rules: (q.logic_rules || []) as any,
        } as any).eq("id", q.id);
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
            config: q.config || {},
            logic_rules: q.logic_rules || [],
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

  const addQuestion = (type: string) => {
    const active = questions.filter(q => !q._isDeleted);
    const def = getFieldDef(type);
    const isSection = type === "section";
    const defaults: Partial<Question> = { config: {}, logic_rules: [] };
    if (needsOptions(type)) defaults.options = ["Opsi 1", "Opsi 2"];
    if (needsImageOptions(type)) defaults.options = [];
    if (type === "slider") defaults.config = { min: 0, max: 100, step: 1 };
    if (type === "rating") defaults.config = { scale_max: 5 };
    if (type === "semantic_diff") defaults.config = { scale_left_label: "Buruk", scale_right_label: "Baik" };
    if (type === "year") defaults.config = { min: new Date().getFullYear() - 50, max: new Date().getFullYear() + 5 };
    if (type === "heading") defaults.config = { heading_level: "h2" };

    setQuestions([...questions, {
      id: crypto.randomUUID(),
      label: isSection ? "Bagian baru" : (def?.label || "Pertanyaan baru"),
      field_type: isSection ? "section" : type,
      is_required: false,
      field_order: active.length,
      options: defaults.options ?? null,
      placeholder: null,
      description: null,
      is_section_break: isSection,
      section_title: isSection ? "Bagian baru" : null,
      section_description: null,
      config: defaults.config || {},
      logic_rules: [],
      _isNew: true,
    }]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...updates } : q));
  };
  const updateConfig = (id: string, patch: any) =>
    updateQuestion(id, { config: { ...(questions.find(q => q.id === id)?.config || {}), ...patch } });

  const markDelete = (q: Question) => {
    if (q._isNew) setQuestions(qs => qs.filter(x => x.id !== q.id));
    else updateQuestion(q.id, { _isDeleted: true });
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

  const copyLink = () => {
    if (form) {
      navigator.clipboard.writeText(`https://ms.talco.id/f/${form.slug}`);
      toast.success("Link disalin!");
    }
  };

  const setDesignField = (k: string, v: any) => setDesign((d: any) => ({ ...(d || {}), [k]: v }));
  const applyPreset = (p: typeof PRESET_THEMES[number]) =>
    setDesign((d: any) => ({ ...(d || {}), primary_color: p.primary, background_color: p.bg, text_color: p.text }));

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
                    <div className="flex-1 space-y-3 min-w-0">
                      {q.is_section_break ? (
                        <SectionFields q={q} update={updateQuestion} />
                      ) : (
                        <QuestionFields
                          q={q}
                          allQuestions={activeQuestions}
                          update={updateQuestion}
                          updateConfig={updateConfig}
                        />
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteQ(q)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <AddFieldMenu onAdd={addQuestion} />
          </TabsContent>

          <TabsContent value="design" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Preset</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_THEMES.map(p => (
                      <button key={p.name} type="button" onClick={() => applyPreset(p)}
                        className="rounded-xl border p-3 text-left hover:border-primary transition-all hover:-translate-y-0.5"
                        style={{ background: p.bg, color: p.text }}>
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
                    <Switch checked={design?.show_progress !== false} onCheckedChange={v => setDesignField("show_progress", v)} />
                    <Label className="text-sm">Tampilkan progress bar</Label>
                  </div>
                  <div>
                    <Label className="text-xs">Label Tombol Submit</Label>
                    <Input value={design?.submit_label || ""} onChange={e => setDesignField("submit_label", e.target.value)} placeholder="Kirim" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Deskripsi / Welcome Message</Label>
                  <Textarea value={design?.description || ""} onChange={e => setDesignField("description", e.target.value)}
                    placeholder="Halo! Form ini hanya butuh 2 menit untuk diisi..." rows={3} />
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
                  <Textarea value={design?.thank_you_message || ""} onChange={e => setDesignField("thank_you_message", e.target.value)}
                    placeholder="Respons Anda berhasil dikirim. Tim kami akan menghubungi Anda segera." rows={4} />
                </div>
                <div>
                  <Label className="text-xs">Gambar Thank-You (URL, opsional)</Label>
                  <Input value={design?.thank_you_image || ""} onChange={e => setDesignField("thank_you_image", e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Redirect ke URL (setelah submit)</Label>
                    <Input value={design?.thank_you_redirect_url || ""}
                      onChange={e => setDesignField("thank_you_redirect_url", e.target.value)}
                      placeholder="https://contoh.com/terima-kasih" />
                    <p className="text-[10px] text-muted-foreground mt-1">Kosongkan untuk tetap di halaman thank-you</p>
                  </div>
                  <div>
                    <Label className="text-xs">Delay (detik)</Label>
                    <Input type="number" min={0} max={60}
                      value={design?.thank_you_redirect_delay ?? 3}
                      onChange={e => setDesignField("thank_you_redirect_delay", parseInt(e.target.value) || 0)} />
                  </div>
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

// =============== Add-field popover menu (categorized) ===============
function AddFieldMenu({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const categories: FieldCategory[] = ["basic", "choice", "scale", "datetime", "upload", "location", "special", "calc", "structure"];
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex-1 border-dashed">
            <Plus className="mr-2 h-4 w-4" />Tambah Field
            <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(95vw,640px)] max-h-[70vh] overflow-y-auto p-3" align="start">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {categories.map(cat => (
              <div key={cat} className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="space-y-1">
                  {FIELD_TYPES.filter(t => t.category === cat).map(t => (
                    <button key={t.value} type="button"
                      onClick={() => { onAdd(t.value); setOpen(false); }}
                      className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="outline" className="flex-1 border-dashed" onClick={() => onAdd("section")}>
        <SeparatorHorizontal className="mr-2 h-4 w-4" />Tambah Bagian (Page Break)
      </Button>
    </div>
  );
}

// =============== Section editor ===============
function SectionFields({ q, update }: { q: Question; update: (id: string, u: Partial<Question>) => void }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <SeparatorHorizontal className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Section / Page Break</span>
      </div>
      <Input value={q.section_title || ""}
        onChange={e => update(q.id, { section_title: e.target.value, label: e.target.value })}
        placeholder="Judul bagian..." className="text-base font-medium" />
      <Textarea value={q.section_description || ""}
        onChange={e => update(q.id, { section_description: e.target.value })}
        placeholder="Deskripsi singkat untuk bagian ini (opsional)" rows={2} />
    </>
  );
}

// =============== Question editor (per-field) ===============
function QuestionFields({
  q, allQuestions, update, updateConfig,
}: {
  q: Question; allQuestions: Question[];
  update: (id: string, u: Partial<Question>) => void;
  updateConfig: (id: string, patch: any) => void;
}) {
  const def = getFieldDef(q.field_type);
  const display = isDisplayBlock(q.field_type);
  const cfg = q.config || {};

  // Switch type cleans up incompatible defaults
  const changeType = (v: string) => {
    const newCfg: any = {};
    if (v === "slider") Object.assign(newCfg, { min: 0, max: 100, step: 1 });
    if (v === "rating") Object.assign(newCfg, { scale_max: 5 });
    if (v === "semantic_diff") Object.assign(newCfg, { scale_left_label: "Buruk", scale_right_label: "Baik" });
    if (v === "year") Object.assign(newCfg, { min: new Date().getFullYear() - 50, max: new Date().getFullYear() + 5 });
    if (v === "heading") Object.assign(newCfg, { heading_level: "h2" });
    update(q.id, {
      field_type: v,
      options: needsOptions(v) ? (q.options || ["Opsi 1", "Opsi 2"]) : needsImageOptions(v) ? (q.options || []) : null,
      config: newCfg,
    });
  };

  return (
    <>
      <div className="flex gap-2 flex-col sm:flex-row">
        <Input value={q.label}
          onChange={e => update(q.id, { label: e.target.value })}
          placeholder={display ? "Heading / paragraf..." : "Pertanyaan..."} className="flex-1" />
        <Select value={q.field_type} onValueChange={changeType}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-[60vh]">
            {(["basic","choice","scale","datetime","upload","location","special","calc","structure"] as FieldCategory[]).map(cat => (
              <div key={cat}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </div>
                {FIELD_TYPES.filter(t => t.category === cat).map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!display && (
        <Textarea value={q.description || ""}
          onChange={e => update(q.id, { description: e.target.value })}
          placeholder="Catatan / penjelasan untuk pertanyaan ini (opsional)"
          rows={2} className="text-sm" />
      )}

      {/* Options for choice fields */}
      {needsOptions(q.field_type) && (
        <div className="space-y-2 pl-4 border-l-2 border-muted">
          <Label className="text-xs text-muted-foreground">Pilihan (satu per baris)</Label>
          <Textarea value={Array.isArray(q.options) ? (q.options as string[]).join("\n") : ""}
            onChange={e => update(q.id, { options: e.target.value.split("\n").filter(Boolean) })}
            placeholder={"Opsi 1\nOpsi 2\nOpsi 3"} rows={3} />
        </div>
      )}

      {/* Image-choice options */}
      {needsImageOptions(q.field_type) && (
        <ImageChoiceEditor q={q} update={update} />
      )}

      {/* Per-type configuration */}
      <TypeConfig q={q} cfg={cfg} updateConfig={updateConfig} allQuestions={allQuestions} />

      {/* Required + placeholder */}
      {!display && q.field_type !== "formula" && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch checked={q.is_required} onCheckedChange={v => update(q.id, { is_required: v })} />
            <Label className="text-sm">Wajib</Label>
          </div>
          <Input value={q.placeholder || ""}
            onChange={e => update(q.id, { placeholder: e.target.value })}
            placeholder="Placeholder (opsional)"
            className="flex-1 text-sm min-w-[200px]" />
        </div>
      )}

      {/* Advanced: Logic rules */}
      <Accordion type="single" collapsible>
        <AccordionItem value="adv" className="border-0">
          <AccordionTrigger className="text-xs py-2 hover:no-underline">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Workflow className="h-3.5 w-3.5" /> Conditional Logic
              {q.logic_rules && q.logic_rules.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px]">{q.logic_rules.length}</span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <LogicEditor q={q} allQuestions={allQuestions} update={update} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}

// =============== Per-type config (min/max/scale/formula/etc) ===============
function TypeConfig({ q, cfg, updateConfig, allQuestions }: {
  q: Question; cfg: any;
  updateConfig: (id: string, patch: any) => void;
  allQuestions: Question[];
}) {
  const t = q.field_type;
  if (t === "number" || t === "slider") {
    return (
      <div className="grid grid-cols-3 gap-2 pl-4 border-l-2 border-muted">
        <div><Label className="text-xs">Min</Label><Input type="number" value={cfg.min ?? ""} onChange={e => updateConfig(q.id, { min: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        <div><Label className="text-xs">Max</Label><Input type="number" value={cfg.max ?? ""} onChange={e => updateConfig(q.id, { max: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        <div><Label className="text-xs">Step</Label><Input type="number" value={cfg.step ?? ""} onChange={e => updateConfig(q.id, { step: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        {t === "slider" && (
          <>
            <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Label Kiri</Label><Input value={cfg.scale_left_label || ""} onChange={e => updateConfig(q.id, { scale_left_label: e.target.value })} /></div>
            <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Label Kanan</Label><Input value={cfg.scale_right_label || ""} onChange={e => updateConfig(q.id, { scale_right_label: e.target.value })} /></div>
          </>
        )}
      </div>
    );
  }
  if (t === "rating") {
    return (
      <div className="grid grid-cols-2 gap-2 pl-4 border-l-2 border-muted">
        <div><Label className="text-xs">Max bintang</Label>
          <Select value={String(cfg.scale_max || 5)} onValueChange={v => updateConfig(q.id, { scale_max: parseInt(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[3, 5, 7, 10].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  if (t === "semantic_diff") {
    return (
      <div className="grid grid-cols-2 gap-2 pl-4 border-l-2 border-muted">
        <div><Label className="text-xs">Label Kiri</Label><Input value={cfg.scale_left_label || ""} onChange={e => updateConfig(q.id, { scale_left_label: e.target.value })} placeholder="Buruk" /></div>
        <div><Label className="text-xs">Label Kanan</Label><Input value={cfg.scale_right_label || ""} onChange={e => updateConfig(q.id, { scale_right_label: e.target.value })} placeholder="Baik" /></div>
      </div>
    );
  }
  if (t === "year") {
    return (
      <div className="grid grid-cols-2 gap-2 pl-4 border-l-2 border-muted">
        <div><Label className="text-xs">Tahun min</Label><Input type="number" value={cfg.min ?? ""} onChange={e => updateConfig(q.id, { min: Number(e.target.value) })} /></div>
        <div><Label className="text-xs">Tahun max</Label><Input type="number" value={cfg.max ?? ""} onChange={e => updateConfig(q.id, { max: Number(e.target.value) })} /></div>
      </div>
    );
  }
  if (t === "long_text") {
    return (
      <div className="pl-4 border-l-2 border-muted">
        <Label className="text-xs">Max karakter (opsional)</Label>
        <Input type="number" value={cfg.max_length || ""} onChange={e => updateConfig(q.id, { max_length: parseInt(e.target.value) || null })} />
      </div>
    );
  }
  if (t === "file" || t === "image_upload" || t === "video_upload" || t === "document_upload") {
    return (
      <div className="pl-4 border-l-2 border-muted">
        <Label className="text-xs">Accept (MIME / ekstensi) — opsional</Label>
        <Input value={cfg.accept || ""} onChange={e => updateConfig(q.id, { accept: e.target.value })} placeholder="image/*  .pdf,.docx  dst" />
      </div>
    );
  }
  if (t === "heading") {
    return (
      <div className="pl-4 border-l-2 border-muted">
        <Label className="text-xs">Level</Label>
        <Select value={cfg.heading_level || "h2"} onValueChange={v => updateConfig(q.id, { heading_level: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="h1">H1 (Besar)</SelectItem>
            <SelectItem value="h2">H2 (Medium)</SelectItem>
            <SelectItem value="h3">H3 (Kecil)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (t === "static_image") {
    return (
      <div className="pl-4 border-l-2 border-muted">
        <Label className="text-xs">URL Gambar</Label>
        <Input value={cfg.image_url || ""} onChange={e => updateConfig(q.id, { image_url: e.target.value })} placeholder="https://..." />
      </div>
    );
  }
  if (t === "video_embed") {
    return (
      <div className="pl-4 border-l-2 border-muted">
        <Label className="text-xs">URL Video (YouTube / Vimeo / embed)</Label>
        <Input value={cfg.embed_url || ""} onChange={e => updateConfig(q.id, { embed_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
      </div>
    );
  }
  if (t === "formula") {
    const numericQs = allQuestions.filter(x => !x.is_section_break && ["number", "slider", "rating", "nps", "formula"].includes(x.field_type));
    return (
      <div className="space-y-2 pl-4 border-l-2 border-muted">
        <Label className="text-xs">Formula (referensikan field dengan {`{id}`})</Label>
        <Textarea rows={2} value={cfg.formula || ""}
          onChange={e => updateConfig(q.id, { formula: e.target.value })}
          placeholder="contoh: {abc123...} * 0.1 + {xyz...}" />
        <div className="text-xs text-muted-foreground">Klik untuk menyisipkan referensi:</div>
        <div className="flex flex-wrap gap-1.5">
          {numericQs.length === 0 && <span className="text-xs italic">Belum ada field numerik. Tambahkan number/slider/rating dulu.</span>}
          {numericQs.map(nq => (
            <button key={nq.id} type="button"
              onClick={() => updateConfig(q.id, { formula: (cfg.formula || "") + `{${nq.id}}` })}
              className="px-2 py-1 rounded border text-xs hover:bg-muted">
              {nq.label || "(tanpa label)"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Prefix</Label><Input value={cfg.prefix || ""} onChange={e => updateConfig(q.id, { prefix: e.target.value })} placeholder="Rp " /></div>
          <div><Label className="text-xs">Suffix</Label><Input value={cfg.suffix || ""} onChange={e => updateConfig(q.id, { suffix: e.target.value })} placeholder=" pts" /></div>
        </div>
      </div>
    );
  }
  return null;
}

// =============== Image choice options editor ===============
function ImageChoiceEditor({ q, update }: { q: Question; update: (id: string, u: Partial<Question>) => void }) {
  const opts: { label: string; url: string }[] = Array.isArray(q.options)
    ? (q.options as any[]).map(o => typeof o === "string"
        ? { label: o.split("|")[0] || "", url: o.split("|")[1] || "" }
        : { label: o.label || "", url: o.url || "" })
    : [];
  const setOpts = (next: { label: string; url: string }[]) => update(q.id, { options: next as any });
  return (
    <div className="space-y-2 pl-4 border-l-2 border-muted">
      <Label className="text-xs text-muted-foreground">Pilihan Gambar</Label>
      {opts.map((o, i) => (
        <div key={i} className="flex gap-2">
          <Input placeholder="Label" value={o.label}
            onChange={e => setOpts(opts.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <Input placeholder="URL gambar" value={o.url}
            onChange={e => setOpts(opts.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
          <Button variant="ghost" size="icon" onClick={() => setOpts(opts.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setOpts([...opts, { label: "Opsi", url: "" }])}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />Tambah gambar
      </Button>
    </div>
  );
}

// =============== Conditional logic editor ===============
function LogicEditor({ q, allQuestions, update }: {
  q: Question; allQuestions: Question[]; update: (id: string, u: Partial<Question>) => void;
}) {
  const rules = q.logic_rules || [];
  const setRules = (next: LogicRule[]) => update(q.id, { logic_rules: next });
  const others = allQuestions.filter(x => x.id !== q.id && !x.is_section_break && !isDisplayBlock(x.field_type));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Pertanyaan ini hanya muncul jika SEMUA kondisi berikut terpenuhi.
      </p>
      {rules.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
          <Select value={r.action || "show"} onValueChange={(v: any) => setRules(rules.map((x, j) => j === i ? { ...x, action: v } : x))}>
            <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="show">Tampilkan jika</SelectItem>
              <SelectItem value="hide">Sembunyikan jika</SelectItem>
            </SelectContent>
          </Select>
          <Select value={r.source_question_id} onValueChange={v => setRules(rules.map((x, j) => j === i ? { ...x, source_question_id: v } : x))}>
            <SelectTrigger className="col-span-4 h-8 text-xs"><SelectValue placeholder="Pilih field..." /></SelectTrigger>
            <SelectContent>
              {others.map(o => <SelectItem key={o.id} value={o.id}>{o.label || "(tanpa label)"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={r.operator} onValueChange={(v: any) => setRules(rules.map((x, j) => j === i ? { ...x, operator: v } : x))}>
            <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">=</SelectItem>
              <SelectItem value="not_equals">≠</SelectItem>
              <SelectItem value="contains">contains</SelectItem>
              <SelectItem value="not_contains">!contains</SelectItem>
              <SelectItem value="greater">&gt;</SelectItem>
              <SelectItem value="less">&lt;</SelectItem>
              <SelectItem value="is_empty">kosong</SelectItem>
              <SelectItem value="not_empty">tidak kosong</SelectItem>
            </SelectContent>
          </Select>
          <Input className="col-span-2 h-8 text-xs"
            value={r.value || ""}
            disabled={r.operator === "is_empty" || r.operator === "not_empty"}
            onChange={e => setRules(rules.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
            placeholder="value" />
          <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8"
            onClick={() => setRules(rules.filter((_, j) => j !== i))}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" disabled={others.length === 0}
        onClick={() => setRules([...rules, { source_question_id: others[0]?.id || "", operator: "equals", value: "", action: "show" }])}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />Tambah rule
      </Button>
      {others.length === 0 && <p className="text-xs italic text-muted-foreground">Belum ada pertanyaan lain untuk dijadikan kondisi.</p>}
    </div>
  );
}

// Silence unused (Settings icon could be wired later)
export { Settings as _S };
