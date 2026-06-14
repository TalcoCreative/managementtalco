import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Star, Upload, Check, Image as ImageIcon, MapPin, QrCode, Loader2,
  PenLine, Eraser, X,
} from "lucide-react";
import {
  defaultAcceptFor, evalFormula, isDisplayBlock, needsImageOptions,
  parseImageOptions,
} from "@/lib/form-fields";

export interface RendererQuestion {
  id: string;
  label: string;
  field_type: string;
  is_required: boolean;
  options: string[] | null;
  placeholder: string | null;
  description?: string | null;
  is_section_break?: boolean | null;
  config?: any;
}

export interface RendererTheme {
  primary: string;
  primaryText: string;
  text: string;
  muted: string;
  border: string;
  surface: string;
  subtle: string;
  isDarkBg: boolean;
}

interface Props {
  q: RendererQuestion;
  theme: RendererTheme;
  // Value state
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  checkboxAnswers: Record<string, string[]>;
  setCheckboxAnswers: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  files: Record<string, File>;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, File>>>;
  signatureUrls?: Record<string, string>; // ignored — signatures stored as data URLs in answers[qId]
  onAutoAdvance?: () => void;
  /** Map of qId -> label so formula editor can show names (optional). */
  questionsById?: Record<string, RendererQuestion>;
  inputSize?: string; // tailwind text size class
  registerFocus?: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}

const EMOJIS = ["😡", "🙁", "😐", "🙂", "😍"];

export function FormFieldRenderer(props: Props) {
  const { q, theme, answers, setAnswers, checkboxAnswers, setCheckboxAnswers, files, setFiles,
    onAutoAdvance, questionsById, inputSize = "text-lg", registerFocus } = props;
  const cfg = q.config || {};
  const accept = cfg.accept || defaultAcceptFor(q.field_type);

  const baseStyle: React.CSSProperties = {
    background: "transparent",
    color: theme.text,
    borderColor: theme.border,
    caretColor: theme.primary,
  };
  const underline = `w-full bg-transparent border-0 border-b-2 rounded-none px-0 py-3 focus-visible:ring-0 focus-visible:border-current placeholder:opacity-40 ${inputSize}`;

  // -------- Display blocks (no answer) --------
  if (isDisplayBlock(q.field_type)) {
    return <DisplayBlock q={q} theme={theme} answers={answers} />;
  }

  // -------- Choice helpers --------
  const Chip = ({ selected, onClick, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      className="text-left px-4 py-3 rounded-xl border-2 transition-all hover:-translate-y-0.5 active:scale-[0.99] flex items-center gap-3"
      style={{
        borderColor: selected ? theme.primary : theme.border,
        background: selected ? `${theme.primary}1a` : theme.surface,
        color: theme.text,
      }}
    >
      {children}
    </button>
  );

  switch (q.field_type) {
    // ---- Basic text-ish ----
    case "long_text":
      return (
        <Textarea
          ref={el => registerFocus?.(el)}
          value={answers[q.id] || ""}
          onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
          placeholder={q.placeholder || "Ketik jawaban..."}
          rows={4}
          className={`${underline} resize-none`}
          style={{ ...baseStyle, borderBottomColor: theme.border }}
          maxLength={cfg.max_length || undefined}
        />
      );
    case "short_text":
    case "email":
    case "phone":
    case "url":
    case "password":
    case "number":
      return (
        <Input
          ref={el => registerFocus?.(el)}
          type={
            q.field_type === "email" ? "email" :
            q.field_type === "phone" ? "tel" :
            q.field_type === "url" ? "url" :
            q.field_type === "password" ? "password" :
            q.field_type === "number" ? "number" : "text"
          }
          value={answers[q.id] || ""}
          onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
          placeholder={q.placeholder || "Ketik jawaban..."}
          className={underline}
          style={{ ...baseStyle, borderBottomColor: theme.border, height: "auto" }}
          min={q.field_type === "number" ? cfg.min : undefined}
          max={q.field_type === "number" ? cfg.max : undefined}
          step={q.field_type === "number" ? (cfg.step || "any") : undefined}
          inputMode={q.field_type === "number" ? "decimal" : undefined}
        />
      );

    // ---- Date/Time ----
    case "date":
    case "time":
    case "datetime":
    case "month":
      return (
        <Input
          type={
            q.field_type === "datetime" ? "datetime-local" :
            q.field_type === "month" ? "month" :
            q.field_type === "time" ? "time" : "date"
          }
          value={answers[q.id] || ""}
          onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
          className={underline}
          style={{ ...baseStyle, borderBottomColor: theme.border, height: "auto" }}
        />
      );
    case "year": {
      const years: number[] = [];
      const cur = new Date().getFullYear();
      const minY = cfg.min || cur - 80;
      const maxY = cfg.max || cur + 5;
      for (let y = maxY; y >= minY; y--) years.push(y);
      return (
        <select
          value={answers[q.id] || ""}
          onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
          className={`${underline} appearance-none cursor-pointer`}
          style={{ ...baseStyle, borderBottomColor: theme.border }}
        >
          <option value="">Pilih tahun...</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      );
    }

    // ---- Choice ----
    case "dropdown":
    case "multiple_choice": {
      const opts = q.options || [];
      return (
        <div className="flex flex-col gap-2.5 mt-2">
          {opts.map((opt, i) => {
            const selected = answers[q.id] === opt;
            const letter = String.fromCharCode(65 + i);
            return (
              <Chip key={opt + i} selected={selected} onClick={() => {
                setAnswers(p => ({ ...p, [q.id]: opt }));
                if (onAutoAdvance) setTimeout(onAutoAdvance, 250);
              }}>
                <span className="h-7 w-7 shrink-0 rounded-md grid place-items-center text-xs font-semibold border"
                  style={{
                    borderColor: selected ? theme.primary : theme.border,
                    background: selected ? theme.primary : "transparent",
                    color: selected ? theme.primaryText : theme.text,
                  }}>
                  {selected ? <Check className="h-3.5 w-3.5" /> : letter}
                </span>
                <span className="flex-1">{opt}</span>
              </Chip>
            );
          })}
        </div>
      );
    }
    case "checkbox": {
      const curr = checkboxAnswers[q.id] || [];
      return (
        <div className="flex flex-col gap-2.5 mt-2">
          {(q.options || []).map((opt, i) => {
            const selected = curr.includes(opt);
            const letter = String.fromCharCode(65 + i);
            return (
              <Chip key={opt + i} selected={selected} onClick={() =>
                setCheckboxAnswers(p => {
                  const c = p[q.id] || [];
                  return { ...p, [q.id]: selected ? c.filter(x => x !== opt) : [...c, opt] };
                })
              }>
                <span className="h-7 w-7 shrink-0 rounded-md grid place-items-center text-xs font-semibold border"
                  style={{
                    borderColor: selected ? theme.primary : theme.border,
                    background: selected ? theme.primary : "transparent",
                    color: selected ? theme.primaryText : theme.text,
                  }}>
                  {selected ? <Check className="h-3.5 w-3.5" /> : letter}
                </span>
                <span className="flex-1">{opt}</span>
              </Chip>
            );
          })}
          <p className="text-xs mt-1" style={{ color: theme.muted }}>Pilih satu atau lebih</p>
        </div>
      );
    }
    case "yes_no": {
      const v = answers[q.id] || "";
      return (
        <div className="flex gap-3 mt-2">
          {["Ya", "Tidak"].map(label => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setAnswers(p => ({ ...p, [q.id]: label }));
                if (onAutoAdvance) setTimeout(onAutoAdvance, 200);
              }}
              className="flex-1 px-5 py-3 rounded-xl border-2 transition-all hover:-translate-y-0.5 font-medium"
              style={{
                borderColor: v === label ? theme.primary : theme.border,
                background: v === label ? `${theme.primary}1a` : theme.surface,
                color: theme.text,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      );
    }
    case "ranking": {
      const raw = answers[q.id];
      const initial = raw ? raw.split("|") : (q.options || []);
      const [list, setList] = useState<string[]>(initial);
      useEffect(() => {
        setAnswers(p => ({ ...p, [q.id]: list.join("|") }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [list.join("|")]);
      const move = (idx: number, dir: -1 | 1) => {
        const j = idx + dir;
        if (j < 0 || j >= list.length) return;
        const next = [...list];
        [next[idx], next[j]] = [next[j], next[idx]];
        setList(next);
      };
      return (
        <div className="flex flex-col gap-2 mt-2">
          {list.map((opt, i) => (
            <div key={opt}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border-2"
              style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
            >
              <span className="h-7 w-7 shrink-0 grid place-items-center rounded-md text-xs font-bold"
                style={{ background: theme.primary, color: theme.primaryText }}>
                {i + 1}
              </span>
              <span className="flex-1">{opt}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="px-2 py-1 rounded border disabled:opacity-30"
                style={{ borderColor: theme.border }}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1}
                className="px-2 py-1 rounded border disabled:opacity-30"
                style={{ borderColor: theme.border }}>↓</button>
            </div>
          ))}
        </div>
      );
    }
    case "image_choice": {
      const opts = parseImageOptions(q.options);
      const v = answers[q.id] || "";
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {opts.map((o, i) => {
            const selected = v === o.label;
            return (
              <button key={i} type="button"
                onClick={() => {
                  setAnswers(p => ({ ...p, [q.id]: o.label }));
                  if (onAutoAdvance) setTimeout(onAutoAdvance, 250);
                }}
                className="rounded-xl border-2 overflow-hidden transition-all hover:-translate-y-0.5"
                style={{ borderColor: selected ? theme.primary : theme.border, background: theme.surface }}
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img src={o.url} alt={o.label} className="w-full h-full object-cover" />
                </div>
                <div className="px-3 py-2 text-sm" style={{ color: theme.text }}>{o.label}</div>
              </button>
            );
          })}
          {opts.length === 0 && <p className="text-xs col-span-full" style={{ color: theme.muted }}>Tidak ada gambar.</p>}
        </div>
      );
    }

    // ---- Scale ----
    case "likert": {
      const labels = cfg.likert_labels || ["Sangat Tidak Setuju", "Tidak Setuju", "Netral", "Setuju", "Sangat Setuju"];
      const v = answers[q.id] || "";
      return (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-2">
          {labels.map((l: string, i: number) => {
            const val = String(i + 1);
            const selected = v === val;
            return (
              <button key={i} type="button"
                onClick={() => { setAnswers(p => ({ ...p, [q.id]: val })); if (onAutoAdvance) setTimeout(onAutoAdvance, 250); }}
                className="px-3 py-3 rounded-xl border-2 text-sm text-center transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: selected ? theme.primary : theme.border,
                  background: selected ? `${theme.primary}1a` : theme.surface,
                  color: theme.text,
                }}
              >
                <div className="text-lg font-bold mb-1" style={{ color: selected ? theme.primary : theme.text }}>{i + 1}</div>
                <div className="text-[11px] leading-tight" style={{ color: theme.muted }}>{l}</div>
              </button>
            );
          })}
        </div>
      );
    }
    case "rating": {
      const max = cfg.scale_max || 5;
      const v = parseInt(answers[q.id] || "0");
      return (
        <div className="flex gap-2 mt-2">
          {Array.from({ length: max }).map((_, i) => {
            const filled = i < v;
            return (
              <button key={i} type="button"
                onClick={() => { setAnswers(p => ({ ...p, [q.id]: String(i + 1) })); }}
                className="transition-transform hover:scale-110 active:scale-95"
                aria-label={`Rating ${i + 1}`}>
                <Star className="h-9 w-9" style={{
                  color: filled ? theme.primary : theme.border,
                  fill: filled ? theme.primary : "none",
                }} />
              </button>
            );
          })}
        </div>
      );
    }
    case "nps": {
      const v = answers[q.id] || "";
      return (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Array.from({ length: 11 }).map((_, i) => {
            const val = String(i);
            const selected = v === val;
            return (
              <button key={i} type="button"
                onClick={() => { setAnswers(p => ({ ...p, [q.id]: val })); if (onAutoAdvance) setTimeout(onAutoAdvance, 200); }}
                className="h-11 w-11 rounded-lg border-2 font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: selected ? theme.primary : theme.border,
                  background: selected ? theme.primary : theme.surface,
                  color: selected ? theme.primaryText : theme.text,
                }}>
                {i}
              </button>
            );
          })}
          <div className="w-full flex justify-between text-xs mt-1" style={{ color: theme.muted }}>
            <span>Tidak mungkin</span><span>Sangat mungkin</span>
          </div>
        </div>
      );
    }
    case "slider": {
      const min = Number(cfg.min ?? 0);
      const max = Number(cfg.max ?? 100);
      const step = Number(cfg.step ?? 1);
      const v = Number(answers[q.id] || min);
      return (
        <div className="mt-4">
          <div className="text-3xl font-bold mb-3" style={{ color: theme.primary }}>{v}</div>
          <Slider
            value={[v]}
            min={min} max={max} step={step}
            onValueChange={(vals) => setAnswers(p => ({ ...p, [q.id]: String(vals[0]) }))}
          />
          <div className="flex justify-between text-xs mt-2" style={{ color: theme.muted }}>
            <span>{cfg.scale_left_label || min}</span>
            <span>{cfg.scale_right_label || max}</span>
          </div>
        </div>
      );
    }
    case "semantic_diff": {
      const left = cfg.scale_left_label || "Buruk";
      const right = cfg.scale_right_label || "Baik";
      const v = answers[q.id] || "";
      return (
        <div className="mt-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium min-w-[60px] text-right" style={{ color: theme.text }}>{left}</span>
            <div className="flex-1 flex justify-between gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map(n => {
                const sel = v === String(n);
                return (
                  <button key={n} type="button"
                    onClick={() => { setAnswers(p => ({ ...p, [q.id]: String(n) })); if (onAutoAdvance) setTimeout(onAutoAdvance, 250); }}
                    className="h-10 w-10 rounded-full border-2 grid place-items-center text-xs font-semibold transition-all hover:-translate-y-0.5"
                    style={{
                      borderColor: sel ? theme.primary : theme.border,
                      background: sel ? theme.primary : theme.surface,
                      color: sel ? theme.primaryText : theme.text,
                    }}>{n}</button>
                );
              })}
            </div>
            <span className="text-sm font-medium min-w-[60px]" style={{ color: theme.text }}>{right}</span>
          </div>
        </div>
      );
    }
    case "emoji_rating": {
      const v = answers[q.id] || "";
      return (
        <div className="flex gap-2 mt-2 flex-wrap">
          {EMOJIS.map((e, i) => {
            const sel = v === String(i + 1);
            return (
              <button key={i} type="button"
                onClick={() => { setAnswers(p => ({ ...p, [q.id]: String(i + 1) })); if (onAutoAdvance) setTimeout(onAutoAdvance, 200); }}
                className="h-14 w-14 rounded-xl border-2 grid place-items-center text-3xl transition-all hover:scale-110"
                style={{
                  borderColor: sel ? theme.primary : theme.border,
                  background: sel ? `${theme.primary}1a` : theme.surface,
                }}>{e}</button>
            );
          })}
        </div>
      );
    }

    // ---- Upload ----
    case "file":
    case "image_upload":
    case "video_upload":
    case "document_upload":
      return (
        <label className="mt-2 flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer hover:opacity-90 transition-all"
          style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}>
          {q.field_type === "image_upload" ? <ImageIcon className="h-5 w-5" style={{ color: theme.primary }} />
            : <Upload className="h-5 w-5" style={{ color: theme.primary }} />}
          <span className="flex-1 truncate">{files[q.id]?.name || q.placeholder || "Klik untuk upload"}</span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) setFiles(p => ({ ...p, [q.id]: file }));
            }}
          />
        </label>
      );

    // ---- Location ----
    case "address":
      return (
        <Textarea
          ref={el => registerFocus?.(el)}
          value={answers[q.id] || ""}
          onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
          placeholder={q.placeholder || "Jl. ..., RT/RW, kelurahan, kota, kode pos"}
          rows={3}
          className={`${underline} resize-none`}
          style={{ ...baseStyle, borderBottomColor: theme.border }}
        />
      );
    case "region": {
      // 3 stacked inputs: Provinsi / Kota / Kecamatan combined into one string
      const parts = (answers[q.id] || "||").split("||");
      const set = (i: number, v: string) => {
        const next = [parts[0] || "", parts[1] || "", parts[2] || ""];
        next[i] = v;
        setAnswers(p => ({ ...p, [q.id]: next.join("||") }));
      };
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <Input placeholder="Provinsi" value={parts[0] || ""} onChange={e => set(0, e.target.value)}
            className={underline} style={{ ...baseStyle, borderBottomColor: theme.border, height: "auto" }} />
          <Input placeholder="Kota / Kabupaten" value={parts[1] || ""} onChange={e => set(1, e.target.value)}
            className={underline} style={{ ...baseStyle, borderBottomColor: theme.border, height: "auto" }} />
          <Input placeholder="Kecamatan" value={parts[2] || ""} onChange={e => set(2, e.target.value)}
            className={underline} style={{ ...baseStyle, borderBottomColor: theme.border, height: "auto" }} />
        </div>
      );
    }
    case "gps":
      return <GpsCapture qId={q.id} answers={answers} setAnswers={setAnswers} theme={theme} />;
    case "map":
      return <MapView qId={q.id} answers={answers} setAnswers={setAnswers} theme={theme} />;

    // ---- Special ----
    case "color":
      return (
        <div className="flex items-center gap-3 mt-2">
          <input type="color" value={answers[q.id] || "#3b82f6"}
            onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
            className="h-14 w-20 rounded-lg border cursor-pointer"
            style={{ borderColor: theme.border }} />
          <Input value={answers[q.id] || ""} placeholder="#3b82f6"
            onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
            className={underline}
            style={{ ...baseStyle, borderBottomColor: theme.border, height: "auto" }} />
        </div>
      );
    case "signature":
      return <SignaturePad qId={q.id} answers={answers} setAnswers={setAnswers} theme={theme} />;
    case "qr_scanner":
    case "barcode_scanner":
      return <CodeScanner qId={q.id} answers={answers} setAnswers={setAnswers} theme={theme}
        which={q.field_type === "qr_scanner" ? "qr" : "barcode"} />;

    // ---- Calc ----
    case "formula": {
      const expr = (q.config?.formula || "") as string;
      const computed = evalFormula(expr, answers);
      // Sync into answers so submission stores it
      useEffect(() => {
        setAnswers(p => p[q.id] === computed ? p : ({ ...p, [q.id]: computed }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [computed]);
      const prefix = cfg.prefix || ""; const suffix = cfg.suffix || "";
      return (
        <div className="mt-2 px-4 py-4 rounded-xl border-2"
          style={{ borderColor: theme.border, background: theme.surface }}>
          <div className="text-3xl font-bold tabular-nums" style={{ color: theme.primary }}>
            {prefix}{computed || "—"}{suffix}
          </div>
          {!expr && (
            <p className="text-xs mt-2" style={{ color: theme.muted }}>Formula belum di-set oleh admin.</p>
          )}
        </div>
      );
    }

    default:
      return (
        <p className="text-sm italic mt-2" style={{ color: theme.muted }}>
          Tipe "{q.field_type}" belum didukung.
        </p>
      );
  }
}

// ---------- Display block ----------
function DisplayBlock({ q, theme, answers }: { q: RendererQuestion; theme: RendererTheme; answers: Record<string, string> }) {
  const cfg = q.config || {};
  switch (q.field_type) {
    case "heading": {
      const level = cfg.heading_level || "h2";
      const Tag: any = level;
      return <Tag className={`font-bold tracking-tight ${level === "h1" ? "text-4xl" : level === "h2" ? "text-3xl" : "text-2xl"}`} style={{ color: theme.text }}>{q.label || "Heading"}</Tag>;
    }
    case "paragraph":
      return <p className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: theme.muted }}>{q.description || q.label}</p>;
    case "divider":
      return <hr className="my-2" style={{ borderColor: theme.border }} />;
    case "static_image":
      return cfg.image_url ? <img src={cfg.image_url} alt={q.label} className="rounded-xl w-full" /> : null;
    case "video_embed": {
      const url = cfg.embed_url || "";
      const embed = toEmbedUrl(url);
      return embed ? (
        <div className="aspect-video rounded-xl overflow-hidden border" style={{ borderColor: theme.border }}>
          <iframe src={embed} title={q.label} className="w-full h-full" allowFullScreen />
        </div>
      ) : null;
    }
    default:
      return null;
  }
}

function toEmbedUrl(url: string): string {
  if (!url) return "";
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  return url;
}

// ---------- GPS ----------
function GpsCapture({ qId, answers, setAnswers, theme }: {
  qId: string; answers: Record<string, string>; setAnswers: any; theme: RendererTheme;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v = answers[qId] || "";

  const capture = () => {
    if (!navigator.geolocation) { setErr("Geolocation tidak didukung di browser Anda"); return; }
    setLoading(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
        setAnswers((p: any) => ({ ...p, [qId]: c }));
        setLoading(false);
      },
      e => { setErr(e.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const [lat, lng] = v.split(",");
  return (
    <div className="mt-2 space-y-3">
      <button type="button" onClick={capture} disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all hover:-translate-y-0.5 disabled:opacity-60"
        style={{ background: theme.primary, color: theme.primaryText }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {v ? "Update Lokasi" : "Ambil Lokasi Saya"}
      </button>
      {v && (
        <div className="text-sm" style={{ color: theme.muted }}>
          Lat: <span className="tabular-nums font-mono" style={{ color: theme.text }}>{lat}</span>{" · "}
          Lng: <span className="tabular-nums font-mono" style={{ color: theme.text }}>{lng}</span>
        </div>
      )}
      {v && (
        <div className="aspect-video rounded-xl overflow-hidden border" style={{ borderColor: theme.border }}>
          <iframe
            title="map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.005}%2C${parseFloat(lat) - 0.005}%2C${parseFloat(lng) + 0.005}%2C${parseFloat(lat) + 0.005}&layer=mapnik&marker=${lat}%2C${lng}`}
            className="w-full h-full"
          />
        </div>
      )}
      {err && <p className="text-sm text-red-500">{err}</p>}
    </div>
  );
}

function MapView({ qId, answers, setAnswers, theme }: {
  qId: string; answers: Record<string, string>; setAnswers: any; theme: RendererTheme;
}) {
  const [q, setQ] = useState(answers[qId] || "");
  const submit = () => setAnswers((p: any) => ({ ...p, [qId]: q }));
  return (
    <div className="mt-2 space-y-3">
      <div className="flex gap-2">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari alamat atau koordinat lat,lng"
          className="flex-1" />
        <button type="button" onClick={submit}
          className="px-4 py-2 rounded-lg font-medium"
          style={{ background: theme.primary, color: theme.primaryText }}>Cari</button>
      </div>
      {answers[qId] && (
        <div className="aspect-video rounded-xl overflow-hidden border" style={{ borderColor: theme.border }}>
          <iframe
            title="map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=-180,-85,180,85&layer=mapnik&marker=${encodeURIComponent(answers[qId])}`}
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
}

// ---------- Signature Pad ----------
function SignaturePad({ qId, answers, setAnswers, theme }: {
  qId: string; answers: Record<string, string>; setAnswers: any; theme: RendererTheme;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    // Set proper resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Pre-fill if existing
    if (answers[qId]?.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = answers[qId];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e: any) => {
    const r = ref.current!.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x, y };
  };
  const start = (e: any) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const move = (e: any) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y); ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setAnswers((p: any) => ({ ...p, [qId]: ref.current!.toDataURL("image/png") }));
  };
  const clear = () => {
    const c = ref.current!; const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setAnswers((p: any) => ({ ...p, [qId]: "" }));
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="rounded-xl border-2 overflow-hidden touch-none"
        style={{ borderColor: theme.border, background: theme.surface }}>
        <canvas
          ref={ref}
          className="block w-full h-48 cursor-crosshair"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>
      <div className="flex items-center gap-2 text-xs" style={{ color: theme.muted }}>
        <PenLine className="h-3.5 w-3.5" /> Tanda tangan di kotak di atas
        <button type="button" onClick={clear}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded border"
          style={{ borderColor: theme.border, color: theme.text }}>
          <Eraser className="h-3 w-3" /> Hapus
        </button>
      </div>
    </div>
  );
}

// ---------- Code Scanner (QR/Barcode via BarcodeDetector API) ----------
function CodeScanner({ qId, answers, setAnswers, theme, which }: {
  qId: string; answers: Record<string, string>; setAnswers: any; theme: RendererTheme; which: "qr" | "barcode";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const start = async () => {
    setErr(null);
    if (!supported) { setErr("Browser ini tidak mendukung scanner. Ketik manual di bawah."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setActive(true);
      // @ts-ignore
      const formats = which === "qr" ? ["qr_code"] : ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39"];
      // @ts-ignore
      const detector = new window.BarcodeDetector({ formats });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes[0]?.rawValue) {
            setAnswers((p: any) => ({ ...p, [qId]: codes[0].rawValue }));
            stop();
            return;
          }
        } catch {}
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setErr(e.message || "Gagal mengakses kamera");
    }
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="mt-2 space-y-2">
      {active ? (
        <div className="relative rounded-xl overflow-hidden border-2" style={{ borderColor: theme.primary }}>
          <video ref={videoRef} className="w-full block" muted playsInline />
          <button type="button" onClick={stop}
            className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full"
            style={{ background: theme.primary, color: theme.primaryText }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={start}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-medium hover:-translate-y-0.5 transition-all"
          style={{ background: theme.primary, color: theme.primaryText }}>
          <QrCode className="h-4 w-4" /> {answers[qId] ? "Scan Ulang" : `Buka Scanner ${which === "qr" ? "QR" : "Barcode"}`}
        </button>
      )}
      {answers[qId] && (
        <div className="px-3 py-2 rounded-lg border text-sm font-mono"
          style={{ borderColor: theme.border, color: theme.text, background: theme.surface }}>{answers[qId]}</div>
      )}
      <Input
        placeholder="Atau ketik manual"
        value={answers[qId] || ""}
        onChange={e => setAnswers((p: any) => ({ ...p, [qId]: e.target.value }))}
      />
      {err && <p className="text-sm text-red-500">{err}</p>}
    </div>
  );
}

// Silence "ImageIcon"/"Switch" unused if treeshake worries
export { Switch as _Switch };
