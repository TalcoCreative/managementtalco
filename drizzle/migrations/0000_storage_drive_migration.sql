CREATE TABLE public.storage_drive_map (
  bucket text NOT NULL,
  path text NOT NULL,
  drive_id text,
  drive_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, path)
);
GRANT ALL ON public.storage_drive_map TO service_role;
ALTER TABLE public.storage_drive_map ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.storage_objects_pending(_limit int)
RETURNS TABLE(bucket text, path text, mimetype text, size bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  select o.bucket_id, o.name, o.metadata->>'mimetype', (o.metadata->>'size')::bigint
  from storage.objects o
  where o.name not like '%.emptyFolderPlaceholder'
    and not exists (select 1 from public.storage_drive_map m where m.bucket=o.bucket_id and m.path=o.name)
  order by o.created_at
  limit _limit
$$;
REVOKE ALL ON FUNCTION public.storage_objects_pending(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_objects_pending(int) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_storage_drive_map()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text := 'https://kuidassgxkopjdqziqvq.supabase.co/storage/v1/object/public/';
  t record; m record; total int := 0; n int;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('recruitment_form_submissions','submission_data','jsonb'),
    ('candidates','cv_url','text'),
    ('slide_blocks','content','jsonb'),
    ('task_attachments','file_url','text'),
    ('talents','photo_url','text'),
    ('talents','photos','jsonb'),
    ('form_answers','answer_file_url','text'),
    ('profiles','avatar_url','text'),
    ('client_documents','file_url','text'),
    ('client_contracts','file_url','text'),
    ('company_settings','setting_value','text'),
    ('clients','client_logo','text')
  ) v(tbl,col,typ) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t.tbl AND column_name=t.col) THEN CONTINUE; END IF;
    FOR m IN SELECT bucket, path, drive_url FROM storage_drive_map WHERE drive_url IS NOT NULL LOOP
      EXECUTE format(
        'UPDATE public.%I SET %I = replace(replace(%I::text, %L, %L), %L, %L)::%s WHERE %I::text LIKE %L OR %I::text LIKE %L',
        t.tbl, t.col, t.col,
        base||m.bucket||'/'||m.path, m.drive_url,
        base||m.bucket||'/'||replace(m.path,' ','%20'), m.drive_url,
        t.typ,
        t.col, '%'||replace(replace(base||m.bucket||'/'||m.path,'_','\_'),'%','\%')||'%',
        t.col, '%'||replace(replace(base||m.bucket||'/'||replace(m.path,' ','%20'),'_','\_'),'%','\%')||'%');
      GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    END LOOP;
  END LOOP;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.apply_storage_drive_map() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_storage_drive_map() TO service_role;