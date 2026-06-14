// Catalog of all supported form field types + helpers for the form builder
// and the public renderer.

export type FieldCategory =
  | "basic"
  | "choice"
  | "scale"
  | "datetime"
  | "upload"
  | "location"
  | "special"
  | "calc"
  | "structure";

export interface FieldTypeDef {
  value: string;
  label: string;
  category: FieldCategory;
  /** Display-only blocks don't store an answer and aren't validated as required. */
  display?: boolean;
  needsOptions?: boolean;
  /** Stored as image_choice options: array of {label, url} JSON strings in `options` */
  needsImageOptions?: boolean;
  hint?: string;
}

export const FIELD_TYPES: FieldTypeDef[] = [
  // Basic
  { value: "short_text", label: "Teks Singkat", category: "basic" },
  { value: "long_text", label: "Paragraf", category: "basic" },
  { value: "email", label: "Email", category: "basic" },
  { value: "phone", label: "Nomor Telepon", category: "basic" },
  { value: "number", label: "Angka", category: "basic" },
  { value: "password", label: "Password", category: "basic" },
  { value: "url", label: "URL / Website", category: "basic" },

  // Choice
  { value: "multiple_choice", label: "Pilihan Ganda (Satu)", category: "choice", needsOptions: true },
  { value: "checkbox", label: "Checkbox (Banyak)", category: "choice", needsOptions: true },
  { value: "dropdown", label: "Dropdown", category: "choice", needsOptions: true },
  { value: "yes_no", label: "Toggle Ya / Tidak", category: "choice" },
  { value: "ranking", label: "Ranking (Urutkan)", category: "choice", needsOptions: true },
  { value: "image_choice", label: "Pilih Gambar", category: "choice", needsImageOptions: true },

  // Scale
  { value: "likert", label: "Likert (5 skala)", category: "scale" },
  { value: "rating", label: "Rating Bintang", category: "scale" },
  { value: "nps", label: "NPS (0–10)", category: "scale" },
  { value: "slider", label: "Slider", category: "scale" },
  { value: "semantic_diff", label: "Semantic Differential", category: "scale" },
  { value: "emoji_rating", label: "Emoji Rating", category: "scale" },

  // Date / Time
  { value: "date", label: "Tanggal", category: "datetime" },
  { value: "time", label: "Waktu", category: "datetime" },
  { value: "datetime", label: "Tanggal & Waktu", category: "datetime" },
  { value: "month", label: "Bulan", category: "datetime" },
  { value: "year", label: "Tahun", category: "datetime" },

  // Upload
  { value: "file", label: "Upload File", category: "upload" },
  { value: "image_upload", label: "Upload Gambar", category: "upload" },
  { value: "video_upload", label: "Upload Video", category: "upload" },
  { value: "document_upload", label: "Upload Dokumen", category: "upload" },

  // Location
  { value: "address", label: "Alamat Lengkap", category: "location" },
  { value: "region", label: "Provinsi/Kota/Kecamatan", category: "location" },
  { value: "gps", label: "GPS Location", category: "location" },
  { value: "map", label: "Peta (lihat lokasi)", category: "location" },

  // Special
  { value: "signature", label: "Tanda Tangan", category: "special" },
  { value: "qr_scanner", label: "QR Code Scanner", category: "special" },
  { value: "barcode_scanner", label: "Barcode Scanner", category: "special" },
  { value: "color", label: "Color Picker", category: "special" },

  // Calc
  { value: "formula", label: "Formula / Auto-hitung", category: "calc", display: true },

  // Structure (display-only blocks)
  { value: "heading", label: "Heading / Judul", category: "structure", display: true },
  { value: "paragraph", label: "Deskripsi / Paragraf", category: "structure", display: true },
  { value: "divider", label: "Divider", category: "structure", display: true },
  { value: "static_image", label: "Gambar", category: "structure", display: true },
  { value: "video_embed", label: "Video Embed", category: "structure", display: true },
];

export const CATEGORY_LABELS: Record<FieldCategory, string> = {
  basic: "Input Dasar",
  choice: "Pilihan Jawaban",
  scale: "Skala & Penilaian",
  datetime: "Tanggal & Waktu",
  upload: "Upload & Media",
  location: "Data Lokasi",
  special: "Elemen Khusus",
  calc: "Field Perhitungan",
  structure: "Struktur Form",
};

export function getFieldDef(type: string): FieldTypeDef | undefined {
  return FIELD_TYPES.find(f => f.value === type);
}

export function isDisplayBlock(type: string): boolean {
  if (type === "section") return true;
  return !!getFieldDef(type)?.display;
}

export function needsOptions(type: string): boolean {
  return !!getFieldDef(type)?.needsOptions;
}

export function needsImageOptions(type: string): boolean {
  return !!getFieldDef(type)?.needsImageOptions;
}

export function defaultAcceptFor(type: string): string | undefined {
  switch (type) {
    case "image_upload": return "image/*";
    case "video_upload": return "video/*";
    case "document_upload":
      return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword";
    default: return undefined;
  }
}

// ---------- Conditional logic ----------
export type LogicOperator =
  | "equals" | "not_equals" | "contains" | "not_contains"
  | "greater" | "less" | "is_empty" | "not_empty";

export interface LogicRule {
  source_question_id: string;
  operator: LogicOperator;
  value?: string;
  action?: "show" | "hide"; // default "show"
}

export interface AnswerLookup {
  answers: Record<string, string>;
  checkboxAnswers: Record<string, string[]>;
  files: Record<string, File | { name: string } | null>;
}

export function getAnswerValue(qId: string, look: AnswerLookup): string {
  if (look.checkboxAnswers[qId]?.length) return look.checkboxAnswers[qId].join(",");
  if (look.files[qId]) return look.files[qId]!.name || "uploaded";
  return look.answers[qId] || "";
}

function compareNumeric(a: string, b: string, op: "greater" | "less"): boolean {
  const na = parseFloat(a); const nb = parseFloat(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return false;
  return op === "greater" ? na > nb : na < nb;
}

export function evalRule(rule: LogicRule, look: AnswerLookup): boolean {
  const v = getAnswerValue(rule.source_question_id, look);
  const target = (rule.value || "").trim();
  switch (rule.operator) {
    case "equals":       return v.toLowerCase() === target.toLowerCase();
    case "not_equals":   return v.toLowerCase() !== target.toLowerCase();
    case "contains":     return v.toLowerCase().includes(target.toLowerCase());
    case "not_contains": return !v.toLowerCase().includes(target.toLowerCase());
    case "greater":      return compareNumeric(v, target, "greater");
    case "less":         return compareNumeric(v, target, "less");
    case "is_empty":     return !v.trim();
    case "not_empty":    return !!v.trim();
    default:             return true;
  }
}

/** A question is visible if it has no rules, OR every rule (AND) passes its action.
 *  Action "show" → rule must be true for question to show.
 *  Action "hide" → rule must be false for question to show. */
export function isQuestionVisible(rules: LogicRule[] | null | undefined, look: AnswerLookup): boolean {
  if (!rules || rules.length === 0) return true;
  return rules.every(r => {
    const passed = evalRule(r, look);
    return (r.action || "show") === "hide" ? !passed : passed;
  });
}

// ---------- Formula evaluator (safe arithmetic over field refs) ----------
// Syntax: use {qid} to reference an answer's numeric value.
// Allowed: digits, + - * / ( ) . , and whitespace.
export function evalFormula(expr: string, answers: Record<string, string>): string {
  if (!expr) return "";
  // Substitute references
  const substituted = expr.replace(/\{([a-f0-9-]{8,})\}/gi, (_, id) => {
    const raw = answers[id] || "0";
    const n = parseFloat(raw);
    return Number.isNaN(n) ? "0" : String(n);
  });
  // Whitelist characters
  if (!/^[\d+\-*/().,\s]*$/.test(substituted)) return "";
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${substituted || "0"});`)();
    if (typeof result === "number" && Number.isFinite(result)) {
      return String(Math.round(result * 1e6) / 1e6);
    }
    return "";
  } catch {
    return "";
  }
}

// Parse image_choice options stored as JSON strings or "label|url" pairs
export interface ImageOption { label: string; url: string }
export function parseImageOptions(options: unknown): ImageOption[] {
  if (!Array.isArray(options)) return [];
  return options.map((o: any) => {
    if (typeof o === "string") {
      const [label, url] = o.split("|");
      return { label: (label || "").trim(), url: (url || "").trim() };
    }
    if (o && typeof o === "object") return { label: o.label || "", url: o.url || "" };
    return { label: "", url: "" };
  }).filter(o => o.url);
}
