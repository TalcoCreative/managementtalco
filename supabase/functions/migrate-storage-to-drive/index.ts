import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { uploadToDrive } from "../_shared/drive.ts";

// Super-admin only. Actions: migrate (batch copy to Drive), apply (rewrite links), cleanup (delete copied Cloud files), status.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: ok } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "super_admin" });
  if (!ok) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "migrate";
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 40);

  if (action === "status") {
    const { data: pending } = await admin.rpc("storage_objects_pending", { _limit: 10000 });
    const { count: done } = await admin.from("storage_drive_map").select("*", { count: "exact", head: true }).not("drive_url", "is", null);
    const { count: failed } = await admin.from("storage_drive_map").select("*", { count: "exact", head: true }).not("error", "is", null);
    return json({ pending: pending?.length ?? 0, done, failed });
  }
  if (action === "apply") {
    const { data, error } = await admin.rpc("apply_storage_drive_map");
    return error ? json({ error: error.message }, 500) : json({ updated: data });
  }
  if (action === "cleanup") {
    const { data: rows } = await admin.from("storage_drive_map").select("bucket,path").not("drive_url", "is", null).limit(limit * 25);
    const byBucket: Record<string, string[]> = {};
    for (const r of rows ?? []) (byBucket[r.bucket] ??= []).push(r.path);
    let removed = 0;
    for (const [b, paths] of Object.entries(byBucket)) {
      const { data } = await admin.storage.from(b).remove(paths);
      removed += data?.length ?? 0;
    }
    return json({ removed });
  }

  const { data: items, error } = await admin.rpc("storage_objects_pending", { _limit: limit });
  if (error) return json({ error: error.message }, 500);
  const results = await Promise.all((items ?? []).map(async (it: any) => {
    try {
      const { data: blob, error: dErr } = await admin.storage.from(it.bucket).download(it.path);
      if (dErr || !blob) throw new Error(dErr?.message ?? "download failed");
      const name = it.path.split("/").pop() || "file";
      const r = await uploadToDrive(it.bucket, name, new Uint8Array(await blob.arrayBuffer()), it.mimetype || blob.type || "application/octet-stream");
      await admin.from("storage_drive_map").upsert({ bucket: it.bucket, path: it.path, drive_id: r.id, drive_url: r.url, error: null });
      return true;
    } catch (e) {
      await admin.from("storage_drive_map").upsert({ bucket: it.bucket, path: it.path, error: String((e as Error).message ?? e).slice(0, 500) });
      return false;
    }
  }));
  return json({ processed: results.length, ok: results.filter(Boolean).length });
});
