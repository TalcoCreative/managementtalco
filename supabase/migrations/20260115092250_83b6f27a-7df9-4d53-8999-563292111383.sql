-- Fix public recruitment submissions for both anonymous and logged-in (non-HR) users
-- 1) Candidates: allow INSERT for anon + authenticated when the source form is active
DROP POLICY IF EXISTS "Public can submit candidate applications" ON public.candidates;

CREATE POLICY "Public can submit candidate applications"
ON public.candidates
FOR INSERT
TO anon, authenticated
WITH CHECK (
  source_form_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.recruitment_forms rf
    WHERE rf.id = candidates.source_form_id
      AND rf.status = 'active'
      -- prevent spoofing: created_by must match the form owner
      AND rf.created_by = candidates.created_by
  )
);

-- 2) Storage: allow upload of recruitment files (CV) to company-assets under recruitment/{form_id}/...
-- Note: we keep UPDATE/DELETE restricted; only INSERT is needed for uploads.
CREATE POLICY "Public can upload recruitment files"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = 'recruitment'
  AND EXISTS (
    SELECT 1
    FROM public.recruitment_forms rf
    WHERE rf.id::text = (storage.foldername(name))[2]
      AND rf.status = 'active'
  )
);