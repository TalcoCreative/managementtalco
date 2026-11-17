import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const ROOT_NAME = "Talco Management System";
const MAX_BYTES = 25 * 1024 * 1024;
const AREAS: Record<string, string> = {
  "task-attachments": "Tasks",
  "client-files": "Clients",
  "client-logos": "Clients",
  "form-uploads": "Forms",
  "talents": "Talent",
  "recruitment": "Recruitment",
  "ep-assets": "Editorial Plan",
  "invoice-assets": "Invoices",
  "avatars": "Avatars",
  "company-assets": "Company",
};
const folderCache = new Map<string, string>();

function headers(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    "X-Connection-Api-Key": Deno.env.get("GOOGLE_DRIVE_API_KEY")!,
    ...extra,
  };
}

async function gw(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { ...headers(), ...(init.headers as any) } });
  if (!res.ok) throw new Error(`[${res.status}] ${await res.text()}`);
  return res.json();
}

async function ensureFolder(name: string, parent?: string): Promise<string> {
  const key = `${parent ?? "root"}/${name}`;
  if (folderCache.has(key)) return folderCache.get(key)!;
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
    (parent ? ` and '${parent}' in parents` : "");
  const found = await gw(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  let id = found.files?.[0]?.id;
  if (!id) {
    const created = await gw(`/drive/v3/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }),
    });
    id = created.id;
  }
  folderCache.set(key, id);
  return id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const form = await req.formData();
    const file = form.get("file");
    const bucket = String(form.get("bucket") ?? "");
    const name = String(form.get("name") ?? "").slice(0, 200);
    if (!(file instanceof File)) return json({ error: "file is required" }, 400);
    if (!AREAS[bucket]) return json({ error: "invalid bucket" }, 400);
    if (file.size === 0 || file.size > MAX_BYTES) return json({ error: "file size must be 1B-25MB" }, 400);

    const root = await ensureFolder(ROOT_NAME);
    const folder = await ensureFolder(AREAS[bucket], root);

    const boundary = "talco" + crypto.randomUUID();
    const meta = JSON.stringify({ name: name || file.name || "file", parents: [folder] });
    const type = file.type || "application/octet-stream";
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
      `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
      new Uint8Array(await file.arrayBuffer()),
      `\r\n--${boundary}--`,
    ]);
    const up = await gw(`/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    await gw(`/drive/v3/files/${up.id}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
    const isImage = (up.mimeType || type).startsWith("image/");
    const url = isImage
      ? `https://lh3.googleusercontent.com/d/${up.id}`
      : `https://drive.google.com/file/d/${up.id}/view`;
    return json({ id: up.id, url, mimeType: up.mimeType });
  } catch (e) {
    console.error("drive-upload failed:", e);
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
});
