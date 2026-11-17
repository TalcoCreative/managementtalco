ALTER TABLE public.storage_drive_map ADD COLUMN IF NOT EXISTS applied boolean NOT NULL DEFAULT false;
GRANT SELECT ON public.storage_drive_map TO authenticated;
CREATE POLICY "Super admins read drive backup log" ON public.storage_drive_map FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.apply_storage_drive_map()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text := 'https://kuidassgxkopjdqziqvq.supabase.co/storage/v1/object/public/';
  t record; m record; total int := 0; n int; u1 text; u2 text;
BEGIN
  FOR m IN SELECT bucket, path, drive_url FROM storage_drive_map WHERE drive_url IS NOT NULL AND NOT applied LIMIT 150 LOOP
    u1 := base||m.bucket||'/'||m.path;
    u2 := base||m.bucket||'/'||replace(m.path,' ','%20');
    FOR t IN SELECT * FROM (VALUES
      ('recruitment_form_submissions','submission_data','jsonb'),('candidates','cv_url','text'),
      ('slide_blocks','content','jsonb'),('task_attachments','file_url','text'),
      ('talents','photo_url','text'),('talents','photos','jsonb'),('form_answers','answer_file_url','text'),
      ('profiles','avatar_url','text'),('client_documents','file_url','text'),('client_contracts','file_url','text'),
      ('company_settings','setting_value','text'),('clients','client_logo','text')
    ) v(tbl,col,typ) LOOP
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t.tbl AND column_name=t.col) THEN CONTINUE; END IF;
      EXECUTE format('UPDATE public.%I SET %I = replace(replace(%I::text, %L, %L), %L, %L)::%s WHERE strpos(%I::text, %L) > 0 OR strpos(%I::text, %L) > 0',
        t.tbl, t.col, t.col, u1, m.drive_url, u2, m.drive_url, t.typ, t.col, u1, t.col, u2);
      GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    END LOOP;
    UPDATE storage_drive_map SET applied = true WHERE bucket=m.bucket AND path=m.path;
  END LOOP;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.apply_storage_drive_map() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_storage_drive_map() TO service_role;