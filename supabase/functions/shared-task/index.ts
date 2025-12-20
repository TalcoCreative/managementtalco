// Lovable Cloud backend function: shared task data (public)
// Allows external viewers (no login) to view task + attachments + comments using share token.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type SharedTaskResponse = {
  task: any;
  attachments: any[];
  comments: any[];
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractStoragePath(fileUrl: string, bucket: string) {
  // Expected formats:
  // - https://<host>/storage/v1/object/public/<bucket>/<path>
  // - https://<host>/storage/v1/object/sign/<bucket>/<path>?token=...
  const idx = fileUrl.indexOf(`${bucket}/`);
  if (idx === -1) return null;
  return fileUrl.slice(idx + `${bucket}/`.length);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token")?.trim() || "";

    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = String(body?.token || "").trim();
    }

    if (!token) return json(400, { error: "Missing token" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(500, { error: "Server misconfigured" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Task
    const { data: task, error: taskError } = await admin
      .from("tasks")
      .select(`
        *,
        projects(title, clients(name)),
        profiles:profiles!fk_tasks_assigned_to_profiles(full_name)
      `)
      .eq("share_token", token)
      .maybeSingle();

    if (taskError) return json(500, { error: taskError.message });
    if (!task) return json(404, { error: "Task not found" });

    // 2) Comments (employee + external)
    const [{ data: employeeComments, error: employeeError }, { data: publicComments, error: publicError }] =
      await Promise.all([
        admin
          .from("comments")
          .select(`
            id,
            content,
            created_at,
            profiles:profiles!fk_comments_author_profiles(full_name)
          `)
          .eq("task_id", task.id)
          .order("created_at", { ascending: true }),
        admin
          .from("task_public_comments")
          .select("id, commenter_name, content, created_at")
          .eq("task_id", task.id)
          .order("created_at", { ascending: true }),
      ]);

    if (employeeError) return json(500, { error: employeeError.message });
    if (publicError) return json(500, { error: publicError.message });

    const combinedComments = [
      ...(publicComments || []).map((c: any) => ({ ...c, type: "public" })),
      ...(employeeComments || []).map((c: any) => ({ ...c, type: "employee" })),
    ].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 3) Attachments (signed URLs for files)
    const { data: attachments, error: attachError } = await admin
      .from("task_attachments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });

    if (attachError) return json(500, { error: attachError.message });

    const bucket = "task-attachments";

    const hydratedAttachments = await Promise.all(
      (attachments || []).map(async (a: any) => {
        const isLink = a?.file_type === "link";
        const attachment_kind = isLink ? "link" : "file";

        // Only files that live in storage need signed URLs
        if (isLink || !a?.file_url) return { ...a, attachment_kind };

        const path = extractStoragePath(a.file_url, bucket);
        if (!path) return { ...a, attachment_kind };

        const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (error || !data?.signedUrl) return { ...a, attachment_kind };

        return { ...a, attachment_kind, signed_url: data.signedUrl };
      })
    );

    const resp: SharedTaskResponse = {
      task,
      attachments: hydratedAttachments,
      comments: combinedComments,
    };

    return json(200, resp);
  } catch (e: any) {
    return json(500, { error: e?.message || "Unknown error" });
  }
});
