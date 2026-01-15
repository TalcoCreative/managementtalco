-- Allow public/anonymous users to insert candidates (for public recruitment form submissions)
CREATE POLICY "Public can submit candidate applications"
ON public.candidates
FOR INSERT
TO anon
WITH CHECK (
  source_form_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.recruitment_forms 
    WHERE id = source_form_id 
    AND status = 'active'
  )
);

-- Also allow public uploads to company-assets for CV files
-- This is handled via storage policies, but let's make sure recruitment_form_submissions allows anon insert
DROP POLICY IF EXISTS "Anyone can submit forms" ON public.recruitment_form_submissions;

CREATE POLICY "Public can submit form applications"
ON public.recruitment_form_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recruitment_forms 
    WHERE id = form_id 
    AND status = 'active'
  )
);