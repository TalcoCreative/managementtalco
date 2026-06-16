
CREATE OR REPLACE FUNCTION public.is_public_form_response(_response_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM form_responses fr
    JOIN forms f ON f.id = fr.form_id
    WHERE fr.id = _response_id AND f.is_public = true AND f.status = 'active'
  )
$$;

DROP POLICY IF EXISTS "Anyone can submit answers to public forms" ON public.form_answers;
CREATE POLICY "Anyone can submit answers to public forms"
ON public.form_answers FOR INSERT TO anon
WITH CHECK (public.is_public_form_response(response_id));
