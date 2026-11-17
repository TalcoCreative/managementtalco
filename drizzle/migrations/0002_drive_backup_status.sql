ALTER TABLE public.storage_drive_map ADD COLUMN IF NOT EXISTS cloud_deleted boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.storage_drive_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  select jsonb_build_object(
    'pending', (select count(*) from storage.objects o where o.name not like '%.emptyFolderPlaceholder' and not exists (select 1 from public.storage_drive_map m where m.bucket=o.bucket_id and m.path=o.name)),
    'pending_mb', (select coalesce(round(sum((o.metadata->>'size')::bigint)/1048576.0),0) from storage.objects o where not exists (select 1 from public.storage_drive_map m where m.bucket=o.bucket_id and m.path=o.name)),
    'done', (select count(*) from public.storage_drive_map where drive_url is not null),
    'failed', (select count(*) from public.storage_drive_map where error is not null and drive_url is null),
    'links_pending', (select count(*) from public.storage_drive_map where drive_url is not null and not applied),
    'cleanup_pending', (select count(*) from public.storage_drive_map where drive_url is not null and applied and not cloud_deleted)
  )
$$;
REVOKE ALL ON FUNCTION public.storage_drive_status() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_drive_status() TO service_role;