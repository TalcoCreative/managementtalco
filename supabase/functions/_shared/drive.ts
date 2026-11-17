const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
export const ROOT_NAME = "Talco Management System";
const MAX_BYTES = 25 * 1024 * 1024;
export const AREAS: Record<string, string> = {
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

export async function gw(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { ...headers(), ...(init.headers as any) } });
  if (!res.ok) throw new Error(`[${res.status}] ${await res.text()}`);
  return res.json();
}

export async function ensureFolder(name: string, parent?: string): Promise<string> {
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


export async function uploadToDrive(bucket: string, name: string, data: Uint8Array, type: string) {
  const root = await ensureFolder(ROOT_NAME);
  const folder = await ensureFolder(AREAS[bucket] ?? "Other", root);
  const boundary = "talco" + crypto.randomUUID();
  const meta = JSON.stringify({ name, parents: [folder] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
    data,
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
  const url = isImage ? `https://lh3.googleusercontent.com/d/${up.id}` : `https://drive.google.com/file/d/${up.id}/view`;
  return { id: up.id as string, url, mimeType: up.mimeType as string };
}
