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
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "super_admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "migrate";
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 40);

  if (action === "status") {
    const { data, error } = await admin.rpc("storage_drive_status");
    return error ? json({ error: error.message }, 500) : json(data);
  }
  if (action === "retry_failed") {
    await admin.from("storage_drive_map").delete().is("drive_url", null).not("error", "is", null);
    return json({ ok: true });
  }
  if (action === "apply") {
    const { data, error } = await admin.rpc("apply_storage_drive_map");
    return error ? json({ error: error.message }, 500) : json({ updated: data });
  }
  if (action === "cleanup") {
    const { data: rows } = await admin.from("storage_drive_map").select("bucket,path")
      .not("drive_url", "is", null).eq("applied", true).eq("cloud_deleted", false).limit(100);
    let removed = 0;
    const byBucket: Record<string, string[]> = {};
    for (const r of rows ?? []) (byBucket[r.bucket] ??= []).push(r.path);
    for (const [b, paths] of Object.entries(byBucket)) {
      const { error } = await admin.storage.from(b).remove(paths);
      if (error) return json({ error: error.message }, 500);
      for (const p of paths) await admin.from("storage_drive_map").update({ cloud_deleted: true }).eq("bucket", b).eq("path", p);
      removed += paths.length;
    }
    return json({ removed });
  }

  const workers = Math.max(1, Number(body.workers) || 1), worker = Number(body.worker) || 0;
  const { data: all, error } = await admin.rpc("storage_objects_pending", { _limit: 400 });
  if (error) return json({ error: error.message }, 500);
  const h = (s: string) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
  const items = (all ?? []).filter((it: any) => h(it.bucket + "/" + it.path) % workers === worker).slice(0, limit);
  let ok = 0, processed = 0, rateLimited = false;
  for (const it of items as any[]) {
    try {
      const { data: blob, error: dErr } = await admin.storage.from(it.bucket).download(it.path);
      if (dErr || !blob) throw new Error(dErr?.message ?? "download failed");
      const name = it.path.split("/").pop() || "file";
      const r = await uploadToDrive(it.bucket, name, new Uint8Array(await blob.arrayBuffer()), it.mimetype || blob.type || "application/octet-stream");
      await admin.from("storage_drive_map").upsert({ bucket: it.bucket, path: it.path, drive_id: r.id, drive_url: r.url, error: null });
      ok++; processed++;
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      if (msg.startsWith("[429]")) { rateLimited = true; break; }
      await admin.from("storage_drive_map").upsert({ bucket: it.bucket, path: it.path, error: msg.slice(0, 500) });
      processed++;
    }
  }
  return json({ processed, ok, rateLimited });
});
