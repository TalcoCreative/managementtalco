
CREATE TABLE IF NOT EXISTS public.kol_database_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kol_id UUID NOT NULL REFERENCES public.kol_database(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(kol_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_kol_database_clients_kol ON public.kol_database_clients(kol_id);
CREATE INDEX IF NOT EXISTS idx_kol_database_clients_client ON public.kol_database_clients(client_id);

ALTER TABLE public.kol_database_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view kol-client assignments"
  ON public.kol_database_clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create kol-client assignments"
  ON public.kol_database_clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete kol-client assignments"
  ON public.kol_database_clients FOR DELETE
  TO authenticated
  USING (true);
