
GRANT SELECT ON public.clients TO anon;

CREATE POLICY "Public can view active clients"
ON public.clients
FOR SELECT
TO anon
USING (status = 'active');
