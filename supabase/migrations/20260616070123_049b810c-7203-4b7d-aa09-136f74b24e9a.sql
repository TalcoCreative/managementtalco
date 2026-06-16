
GRANT SELECT ON public.forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;

GRANT SELECT ON public.form_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_questions TO authenticated;
GRANT ALL ON public.form_questions TO service_role;

GRANT INSERT ON public.form_responses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_responses TO authenticated;
GRANT ALL ON public.form_responses TO service_role;

GRANT INSERT ON public.form_answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_answers TO authenticated;
GRANT ALL ON public.form_answers TO service_role;
