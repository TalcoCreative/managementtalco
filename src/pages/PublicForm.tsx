import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Loader2, ArrowRight, ArrowLeft, ArrowDown, Upload, Check } from "lucide-react";
import { toast } from "sonner";

interface FormData {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  theme?: string;
  form_template?: string | null;
  primary_color?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  background_image?: string | null;
  button_label?: string | null;
  submit_label?: string | null;
  thank_you_title?: string | null;
  thank_you_message?: string | null;
  thank_you_image?: string | null;
  layout_size?: string | null;
  show_progress?: boolean | null;
  one_question_per_page?: boolean | null;
  font_family?: string | null;
}

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
}

// Step is either "welcome", a question/section, or "submit"
type StepKind = "welcome" | "question" | "section" | "submit";
interface Step {
  kind: StepKind;
  q?: Question;
  index: number; // index among non-section questions (for progress)
}

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', system-ui, sans-serif",
  serif: "'Instrument Serif', 'Playfair Display', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  display: "'Sora', 'Inter', sans-serif",
  grotesk: "'Space Grotesk', 'Inter', sans-serif",
};

const SIZE_MAP: Record<string, { wrap: string; title: string; sub: string; input: string }> = {
  small: { wrap: "max-w-xl", title: "text-2xl sm:text-3xl", sub: "text-sm sm:text-base", input: "text-base" },
  medium: { wrap: "max-w-2xl", title: "text-3xl sm:text-4xl", sub: "text-base sm:text-lg", input: "text-lg" },
  large: { wrap: "max-w-3xl", title: "text-4xl sm:text-5xl", sub: "text-lg sm:text-xl", input: "text-xl" },
};

// Auto-derive a readable text color and translucent surface from primary/bg
function hexToRgb(hex: string) {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
  const num = parseInt(n, 16);
  if (Number.isNaN(num)) return { r: 255, g: 255, b: 255 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export default function PublicForm() {
  const { slug } = useParams();
  const [form, setForm] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [checkboxAnswers, setCheckboxAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [dir, setDir] = useState<"down" | "up">("down");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => { loadForm(); }, [slug]);

  const loadForm = async () => {
    try {
      const { data: f, error: fErr } = await supabase
        .from("forms")
        .select("*")
        .eq("slug", slug!)
        .eq("is_public", true)
        .eq("status", "active")
        .single();
      if (fErr || !f) { setError("Form tidak ditemukan atau tidak aktif"); setLoading(false); return; }
      setForm(f as any);

      const { data: qs } = await supabase
        .from("form_questions")
        .select("*")
        .eq("form_id", f.id)
        .order("field_order");
      setQuestions((qs || []).map((q: any) => ({ ...q, options: q.options as string[] | null })));
    } catch {
      setError("Gagal memuat form");
    }
    setLoading(false);
  };

  // Build linear steps: welcome -> [section|question ...] -> submit
  const steps: Step[] = useMemo(() => {
    const out: Step[] = [];
    out.push({ kind: "welcome", index: 0 });
    let qIdx = 0;
    for (const q of questions) {
      if (q.is_section_break) {
        out.push({ kind: "section", q, index: qIdx });
      } else {
        out.push({ kind: "question", q, index: qIdx });
        qIdx += 1;
      }
    }
    out.push({ kind: "submit", index: qIdx });
    return out;
  }, [questions]);

  const totalQuestions = questions.filter(q => !q.is_section_break).length;
  const currentStep = steps[stepIdx];
  const progress = totalQuestions > 0 ? Math.min(100, Math.round((currentStep.index / totalQuestions) * 100)) : 0;

  // Validate single question
  const isFilled = (q?: Question) => {
    if (!q) return true;
    if (q.field_type === "checkbox") return (checkboxAnswers[q.id]?.length || 0) > 0;
    if (q.field_type === "file") return !!files[q.id];
    return !!answers[q.id]?.trim();
  };

  const canAdvance = () => {
    if (currentStep.kind !== "question") return true;
    if (!currentStep.q?.is_required) return true;
    return isFilled(currentStep.q);
  };

  const next = () => {
    if (currentStep.kind === "question" && currentStep.q?.is_required && !isFilled(currentStep.q)) {
      toast.error("Pertanyaan ini wajib diisi");
      return;
    }
    if (stepIdx < steps.length - 1) {
      setDir("down");
      setStepIdx(i => i + 1);
    }
  };
  const prev = () => {
    if (stepIdx > 0) {
      setDir("up");
      setStepIdx(i => i - 1);
    }
  };

  // Keyboard: Enter advances (Shift+Enter for textarea newlines)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (submitted) return;
      if (e.key === "Enter" && !e.shiftKey) {
        const target = e.target as HTMLElement;
        const tag = target?.tagName;
        if (tag === "TEXTAREA") return;
        e.preventDefault();
        if (currentStep.kind === "submit") {
          handleSubmit();
        } else {
          next();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, answers, files, checkboxAnswers, submitted]);

  // Focus input on step change
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus?.(), 250);
    return () => clearTimeout(t);
  }, [stepIdx]);

  const handleSubmit = async () => {
    setSubmitting(true);
    // Final validation
    for (const q of questions) {
      if (q.is_section_break || !q.is_required) continue;
      if (!isFilled(q)) {
        toast.error(`"${q.label}" wajib diisi`);
        const targetIdx = steps.findIndex(s => s.q?.id === q.id);
        if (targetIdx >= 0) setStepIdx(targetIdx);
        setSubmitting(false);
        return;
      }
    }
    try {
      let respondentName: string | null = null;
      let respondentEmail: string | null = null;
      for (const q of questions) {
        const val = answers[q.id];
        if (!val) continue;
        const label = q.label.toLowerCase();
        if (!respondentName && (label.includes("nama") || label.includes("name"))) respondentName = val;
        if (!respondentEmail && (q.field_type === "email" || label.includes("email"))) respondentEmail = val;
      }

      const responseId = crypto.randomUUID();
      const { error: rErr } = await supabase.from("form_responses").insert({
        id: responseId,
        form_id: form!.id,
        respondent_name: respondentName,
        respondent_email: respondentEmail,
      });
      if (rErr) throw rErr;

      const fileUrls: Record<string, string> = {};
      for (const [qId, file] of Object.entries(files)) {
        const ext = file.name.split(".").pop();
        const path = `${form!.id}/${responseId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("form-uploads").upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("form-uploads").getPublicUrl(path);
        fileUrls[qId] = urlData.publicUrl;
      }

      const answerRows = questions
        .filter(q => !q.is_section_break)
        .map(q => {
          let text = answers[q.id] || null;
          if (q.field_type === "checkbox") text = (checkboxAnswers[q.id] || []).join(", ");
          return {
            response_id: responseId,
            question_id: q.id,
            answer_text: text,
            answer_file_url: fileUrls[q.id] || null,
          };
        })
        .filter(a => a.answer_text || a.answer_file_url);

      if (answerRows.length > 0) {
        const { error: aErr } = await supabase.from("form_answers").insert(answerRows);
        if (aErr) throw aErr;
      }

      if (form!.form_template === "kol") {
        try {
          await supabase.functions.invoke("kol-form-submit", {
            body: { form_id: form!.id, answers, questions },
          });
        } catch (kolErr) {
          console.error("KOL auto-insert error:", kolErr);
        }
      }

      setSubmitted(true);
    } catch (err: any) {
      toast.error("Gagal mengirim: " + err.message);
    }
    setSubmitting(false);
  };

  // Theme & adaptive colors
  const theme = useMemo(() => {
    const primary = form?.primary_color || "#6366f1";
    const bg = form?.background_color || "#ffffff";
    const bgRgb = hexToRgb(bg);
    const isDarkBg = luminance(bgRgb) < 0.5;
    const text = form?.text_color || (isDarkBg ? "#f8fafc" : "#0f172a");
    const muted = isDarkBg ? "rgba(248,250,252,0.65)" : "rgba(15,23,42,0.6)";
    const subtle = isDarkBg ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
    const border = isDarkBg ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)";
    const surface = isDarkBg ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)";
    const primaryRgb = hexToRgb(primary);
    const primaryText = luminance(primaryRgb) > 0.55 ? "#0f172a" : "#ffffff";
    const font = FONT_MAP[form?.font_family || "inter"] || FONT_MAP.inter;
    const size = SIZE_MAP[form?.layout_size || "medium"] || SIZE_MAP.medium;
    return { primary, primaryText, bg, text, muted, subtle, border, surface, font, size, isDarkBg };
  }, [form]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-6">
        <div className="text-center text-muted-foreground">{error || "Form tidak ditemukan"}</div>
      </div>
    );
  }

  // Submitted thank-you
  if (submitted) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center px-6 py-12"
        style={{
          fontFamily: theme.font,
          color: theme.text,
          background: form.background_image
            ? `linear-gradient(135deg, ${theme.bg}cc, ${theme.bg}99), url(${form.background_image}) center/cover no-repeat fixed`
            : `radial-gradient(1200px 600px at 20% 0%, ${theme.primary}22, transparent 60%), ${theme.bg}`,
        }}
      >
        <div className={`${theme.size.wrap} w-full mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-500`}>
          {form.thank_you_image ? (
            <img src={form.thank_you_image} alt="" className="mx-auto mb-8 max-h-48 rounded-2xl" />
          ) : (
            <div
              className="mx-auto mb-8 h-20 w-20 rounded-full flex items-center justify-center"
              style={{ background: theme.primary, color: theme.primaryText }}
            >
              <CheckCircle className="h-10 w-10" />
            </div>
          )}
          <h1 className={`${theme.size.title} font-bold mb-4`}>{form.thank_you_title || "Terima kasih!"}</h1>
          <p className={`${theme.size.sub} mb-8`} style={{ color: theme.muted, whiteSpace: "pre-wrap" }}>
            {form.thank_you_message || "Respons Anda berhasil dikirim."}
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setAnswers({});
              setFiles({});
              setCheckboxAnswers({});
              setStepIdx(0);
            }}
            className="px-6 py-2.5 rounded-xl font-medium transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: theme.primary, color: theme.primaryText }}
          >
            Kirim lagi
          </button>
        </div>
      </div>
    );
  }

  const renderInput = (q: Question) => {
    const baseInputStyle: React.CSSProperties = {
      background: "transparent",
      color: theme.text,
      borderColor: theme.border,
      caretColor: theme.primary,
    };
    const inputCls =
      `w-full bg-transparent border-0 border-b-2 rounded-none px-0 py-3 focus-visible:ring-0 focus-visible:border-current placeholder:opacity-40 ${theme.size.input}`;
    switch (q.field_type) {
      case "long_text":
        return (
          <Textarea
            ref={inputRef as any}
            value={answers[q.id] || ""}
            onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
            placeholder={q.placeholder || "Ketik jawaban Anda..."}
            rows={4}
            className={inputCls + " resize-none"}
            style={{ ...baseInputStyle, borderBottomColor: theme.border }}
          />
        );
      case "email":
      case "phone":
      case "number":
      case "date":
      case "short_text":
        return (
          <Input
            ref={inputRef as any}
            type={
              q.field_type === "email" ? "email" :
              q.field_type === "phone" ? "tel" :
              q.field_type === "number" ? "number" :
              q.field_type === "date" ? "date" : "text"
            }
            value={answers[q.id] || ""}
            onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
            placeholder={q.placeholder || "Ketik jawaban Anda..."}
            className={inputCls}
            style={{ ...baseInputStyle, borderBottomColor: theme.border, height: "auto" }}
          />
        );
      case "dropdown":
      case "multiple_choice":
        return (
          <div className="flex flex-col gap-2.5 mt-2">
            {(q.options || []).map((opt, i) => {
              const selected = answers[q.id] === opt;
              const letter = String.fromCharCode(65 + i);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setAnswers(p => ({ ...p, [q.id]: opt }));
                    setTimeout(() => next(), 250);
                  }}
                  className="group text-left px-4 py-3 rounded-xl border-2 transition-all hover:-translate-y-0.5 active:scale-[0.99] flex items-center gap-3"
                  style={{
                    borderColor: selected ? theme.primary : theme.border,
                    background: selected ? `${theme.primary}1a` : theme.surface,
                    color: theme.text,
                  }}
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-md grid place-items-center text-xs font-semibold border"
                    style={{
                      borderColor: selected ? theme.primary : theme.border,
                      background: selected ? theme.primary : "transparent",
                      color: selected ? theme.primaryText : theme.text,
                    }}
                  >
                    {selected ? <Check className="h-3.5 w-3.5" /> : letter}
                  </span>
                  <span className="flex-1">{opt}</span>
                </button>
              );
            })}
          </div>
        );
      case "checkbox":
        return (
          <div className="flex flex-col gap-2.5 mt-2">
            {(q.options || []).map((opt, i) => {
              const curr = checkboxAnswers[q.id] || [];
              const selected = curr.includes(opt);
              const letter = String.fromCharCode(65 + i);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setCheckboxAnswers(p => {
                      const c = p[q.id] || [];
                      return { ...p, [q.id]: selected ? c.filter(x => x !== opt) : [...c, opt] };
                    });
                  }}
                  className="text-left px-4 py-3 rounded-xl border-2 transition-all hover:-translate-y-0.5 active:scale-[0.99] flex items-center gap-3"
                  style={{
                    borderColor: selected ? theme.primary : theme.border,
                    background: selected ? `${theme.primary}1a` : theme.surface,
                    color: theme.text,
                  }}
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-md grid place-items-center text-xs font-semibold border"
                    style={{
                      borderColor: selected ? theme.primary : theme.border,
                      background: selected ? theme.primary : "transparent",
                      color: selected ? theme.primaryText : theme.text,
                    }}
                  >
                    {selected ? <Check className="h-3.5 w-3.5" /> : letter}
                  </span>
                  <span className="flex-1">{opt}</span>
                </button>
              );
            })}
            <p className="text-xs mt-1" style={{ color: theme.muted }}>Pilih satu atau lebih</p>
          </div>
        );
      case "file":
        return (
          <label
            className="mt-2 flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer hover:opacity-90 transition-all"
            style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
          >
            <Upload className="h-5 w-5" style={{ color: theme.primary }} />
            <span className="flex-1 truncate">{files[q.id]?.name || "Klik untuk upload file"}</span>
            <input
              type="file"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) setFiles(p => ({ ...p, [q.id]: file }));
              }}
            />
          </label>
        );
      default:
        return null;
    }
  };

  const stepKey = `${stepIdx}-${dir}`;

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{
        fontFamily: theme.font,
        color: theme.text,
        background: form.background_image
          ? `linear-gradient(135deg, ${theme.bg}cc, ${theme.bg}99), url(${form.background_image}) center/cover no-repeat fixed`
          : `radial-gradient(900px 500px at 100% 0%, ${theme.primary}1a, transparent 55%), radial-gradient(800px 400px at 0% 100%, ${theme.primary}14, transparent 60%), ${theme.bg}`,
      }}
    >
      {/* Top progress bar */}
      {form.show_progress !== false && (
        <div className="sticky top-0 z-20 px-4 pt-3 pb-2 backdrop-blur-md" style={{ background: `${theme.bg}99` }}>
          <div className={`${theme.size.wrap} mx-auto flex items-center gap-3`}>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: theme.subtle }}>
              <div
                className="h-full transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%`, background: theme.primary }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: theme.muted }}>
              {currentStep.kind === "welcome" ? 0 : Math.min(currentStep.index + (currentStep.kind === "question" ? 1 : 0), totalQuestions)}/{totalQuestions}
            </span>
          </div>
        </div>
      )}

      {/* Step body */}
      <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-10">
        <div
          key={stepKey}
          className={`${theme.size.wrap} w-full mx-auto ${dir === "down" ? "animate-in slide-in-from-bottom-6 fade-in" : "animate-in slide-in-from-top-6 fade-in"} duration-300`}
        >
          {currentStep.kind === "welcome" && (
            <div className="text-center sm:text-left">
              <h1 className={`${theme.size.title} font-bold tracking-tight`}>{form.name}</h1>
              {form.description && (
                <p className={`${theme.size.sub} mt-4`} style={{ color: theme.muted, whiteSpace: "pre-wrap" }}>
                  {form.description}
                </p>
              )}
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 sm:justify-start justify-center">
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98] shadow-lg"
                  style={{ background: theme.primary, color: theme.primaryText, boxShadow: `0 12px 30px -10px ${theme.primary}80` }}
                >
                  Mulai <ArrowRight className="h-4 w-4" />
                </button>
                <span className="text-xs" style={{ color: theme.muted }}>tekan <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border }}>Enter</kbd></span>
              </div>
            </div>
          )}

          {currentStep.kind === "section" && currentStep.q && (
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
                style={{ background: `${theme.primary}1f`, color: theme.primary }}>
                Bagian {currentStep.index + 1}
              </div>
              <h2 className={`${theme.size.title} font-bold tracking-tight`}>
                {currentStep.q.section_title || currentStep.q.label || "Bagian Baru"}
              </h2>
              {currentStep.q.section_description && (
                <p className={`${theme.size.sub} mt-4`} style={{ color: theme.muted, whiteSpace: "pre-wrap" }}>
                  {currentStep.q.section_description}
                </p>
              )}
              <button
                type="button"
                onClick={next}
                className="mt-10 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{ background: theme.primary, color: theme.primaryText, boxShadow: `0 12px 30px -10px ${theme.primary}80` }}
              >
                Lanjut <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {currentStep.kind === "question" && currentStep.q && (
            <div>
              <div className="flex items-start gap-3">
                <span className="mt-2 text-sm tabular-nums opacity-60 shrink-0" style={{ color: theme.muted }}>
                  {currentStep.index + 1} <ArrowRight className="inline h-3 w-3 -mt-0.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className={`${theme.size.title} font-semibold tracking-tight leading-tight`}>
                    {currentStep.q.label}
                    {currentStep.q.is_required && <span className="ml-1" style={{ color: theme.primary }}>*</span>}
                  </h2>
                  {currentStep.q.description && (
                    <p className="mt-3 text-sm sm:text-base" style={{ color: theme.muted, whiteSpace: "pre-wrap" }}>
                      {currentStep.q.description}
                    </p>
                  )}
                  <div className="mt-6">{renderInput(currentStep.q)}</div>

                  <div className="mt-8 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={next}
                      disabled={!canAdvance()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: theme.primary, color: theme.primaryText, boxShadow: `0 10px 24px -10px ${theme.primary}80` }}
                    >
                      {form.button_label || "OK"} <Check className="h-4 w-4" />
                    </button>
                    <span className="text-xs" style={{ color: theme.muted }}>
                      tekan <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: theme.border }}>Enter</kbd>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep.kind === "submit" && (
            <div className="text-center sm:text-left">
              <h2 className={`${theme.size.title} font-bold tracking-tight`}>Siap mengirim?</h2>
              <p className={`${theme.size.sub} mt-4`} style={{ color: theme.muted }}>
                Periksa kembali jawaban Anda. Anda bisa kembali ke pertanyaan sebelumnya jika perlu.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-3 sm:justify-start justify-center">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60"
                  style={{ background: theme.primary, color: theme.primaryText, boxShadow: `0 12px 30px -10px ${theme.primary}80` }}
                >
                  {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Mengirim...</>) : (<>{form.submit_label || "Kirim"} <ArrowRight className="h-4 w-4" /></>)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 z-20 px-4 py-3 backdrop-blur-md" style={{ background: `${theme.bg}99`, borderTop: `1px solid ${theme.border}` }}>
        <div className={`${theme.size.wrap} mx-auto flex items-center justify-between`}>
          <div className="text-xs" style={{ color: theme.muted }}>
            Powered by <span className="font-semibold" style={{ color: theme.text }}>Talco</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={stepIdx === 0}
              aria-label="Sebelumnya"
              className="h-9 w-9 grid place-items-center rounded-lg border transition-all hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: theme.border, color: theme.text, background: theme.surface }}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={stepIdx === steps.length - 1}
              aria-label="Berikutnya"
              className="h-9 w-9 grid place-items-center rounded-lg transition-all hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: theme.primary, color: theme.primaryText }}
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
