import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { AREAS, uploadToDrive } from "../_shared/drive.ts";

const MAX_BYTES = 25 * 1024 * 1024;

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
    const r = await uploadToDrive(bucket, name || file.name || "file", new Uint8Array(await file.arrayBuffer()), file.type || "application/octet-stream");
    return json(r);
  } catch (e) {
    console.error("drive-upload failed:", e);
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
});
