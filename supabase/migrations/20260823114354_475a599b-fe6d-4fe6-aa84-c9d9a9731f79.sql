DROP POLICY IF EXISTS "Anyone can submit responses to public forms" ON public.form_responses;
DROP POLICY IF EXISTS "Anyone can submit answers to public forms" ON public.form_answers;

CREATE POLICY "Public can submit form responses"
ON public.form_responses FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can submit form answers"
ON public.form_answers FOR INSERT
TO anon, authenticated
WITH CHECK (true);

GRANT INSERT ON public.form_responses TO anon;
GRANT INSERT ON public.form_answers TO anon;
GRANT SELECT ON public.forms TO anon;
GRANT SELECT ON public.form_questions TO anon;