/**
 * Global upload compression helpers.
 *
 * Every file the app uploads (photos, scans, PDFs, documents) is routed through
 * `compressUpload()` so heavy originals never reach storage at full size.
 */

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp"];

export interface CompressOptions {
  /** Longest edge in pixels for images. */
  maxDimension?: number;
  /** JPEG/WebP quality 0-1. */
  quality?: number;
  /** Files smaller than this (bytes) are left untouched. */
  minSize?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1800,
  quality: 0.72,
  minSize: 120 * 1024, // 120KB
};

function isImage(file: File) {
  return IMAGE_TYPES.includes((file.type || "").toLowerCase());
}

function isPdf(file: File) {
  return (file.type || "").toLowerCase() === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
}

function renameExt(name: string, ext: string) {
  return name.replace(/\.[^./\\]+$/, "") + "." + ext;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Compress a raster image file with resize + re-encode. Falls back to original. */
export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxDimension, quality, minSize } = { ...DEFAULTS, ...options };
  if (file.size <= minSize) return file;

  try {
    const bitmap = await loadBitmap(file);
    const w = (bitmap as ImageBitmap).width;
    const h = (bitmap as ImageBitmap).height;
    if (!w || !h) return file;

    const scale = Math.min(1, maxDimension / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    // White matte so transparent PNGs stay readable once encoded as JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetW, targetH);
    if ("close" in bitmap && typeof (bitmap as ImageBitmap).close === "function") {
      (bitmap as ImageBitmap).close();
    }

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

    let best: { blob: Blob; ext: string; type: string } | null = null;
    for (const [type, ext] of [["image/webp", "webp"], ["image/jpeg", "jpg"]] as const) {
      const blob = await encode(type);
      if (blob && blob.size > 0 && (!best || blob.size < best.blob.size)) {
        best = { blob, ext, type };
      }
    }

    if (!best || best.blob.size >= file.size) return file;
    return new File([best.blob], renameExt(file.name, best.ext), {
      type: best.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** Re-save a PDF with object streams to strip redundant structure. */
export async function compressPdfFile(file: File, options: CompressOptions = {}): Promise<File> {
  const { minSize } = { ...DEFAULTS, ...options };
  if (file.size <= minSize) return file;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    if (out.byteLength >= file.size) return file;
    const buf = new Uint8Array(out).slice().buffer as ArrayBuffer;
    return new File([buf], file.name, { type: "application/pdf", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Main entry point: compress any upload when possible, otherwise return the
 * original file untouched. Never throws.
 */
export async function compressUpload(file: File, options: CompressOptions = {}): Promise<File> {
  if (!file || typeof File === "undefined") return file;
  if (isImage(file)) return compressImageFile(file, options);
  if (isPdf(file)) return compressPdfFile(file, options);
  return file;
}

/** Compress a list of files (images/PDFs), preserving order. */
export async function compressUploads(files: File[], options: CompressOptions = {}): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) out.push(await compressUpload(f, options));
  return out;
}

/** Compress an image data URL (used for camera captures stored inline). */
export async function compressDataUrl(
  dataUrl: string,
  options: CompressOptions = {},
): Promise<string> {
  const { maxDimension, quality } = { ...DEFAULTS, ...options };
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", quality);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

/** Human readable size, for upload feedback. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
