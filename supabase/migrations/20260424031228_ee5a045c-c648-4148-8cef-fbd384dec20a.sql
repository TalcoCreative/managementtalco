DROP POLICY IF EXISTS "Authorized users can view settings" ON public.company_settings;

CREATE POLICY "Authenticated users can view settings"
ON public.company_settings
FOR SELECT
TO authenticated
USING (true);