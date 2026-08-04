CREATE TABLE public.client_embeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  embed_type TEXT NOT NULL DEFAULT 'link',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_embeds_client ON public.client_embeds(client_id);

GRANT SELECT ON public.client_embeds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_embeds TO authenticated;
GRANT ALL ON public.client_embeds TO service_role;

ALTER TABLE public.client_embeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active client embeds"
ON public.client_embeds FOR SELECT TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_embeds.client_id AND c.status = 'active')
);

CREATE POLICY "Authenticated can view all client embeds"
ON public.client_embeds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert client embeds"
ON public.client_embeds FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update client embeds"
ON public.client_embeds FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete client embeds"
ON public.client_embeds FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_client_embeds_updated_at
BEFORE UPDATE ON public.client_embeds
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();