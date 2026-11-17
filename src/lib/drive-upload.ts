import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads a file to Google Drive (via backend function) and returns a public URL.
 * Falls back to Cloud storage (same bucket/path) if Drive is unavailable.
 */
export async function uploadFileToDrive(
  bucket: string,
  path: string,
  file: Blob,
  opts: { contentType?: string; upsert?: boolean } = {},
): Promise<string> {
  const name = (file as File).name || path.split("/").pop() || "file";
  try {
    const fd = new FormData();
    fd.append("file", file instanceof File ? file : new File([file], name, { type: opts.contentType || file.type }));
    fd.append("bucket", bucket);
    fd.append("name", name);
    const { data, error } = await supabase.functions.invoke("drive-upload", { body: fd });
    if (error) throw error;
    if (!data?.url) throw new Error(data?.error || "Drive upload failed");
    return data.url as string;
  } catch (e) {
    console.warn("Drive upload failed, falling back to Cloud storage:", e);
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: opts.upsert ?? true,
      contentType: opts.contentType,
    });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
}
