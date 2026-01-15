-- Relax public candidate submission policy: only require an active source form
-- (prevents RLS failure if created_by is missing/mismatched in client payload)
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
  )
);