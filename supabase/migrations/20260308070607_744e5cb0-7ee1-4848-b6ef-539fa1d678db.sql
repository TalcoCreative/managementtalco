
CREATE TABLE public.marketplace_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL DEFAULT 'tokopedia',
  report_month INTEGER NOT NULL,
  report_year INTEGER NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  total_products_sold INTEGER DEFAULT 0,
  store_visitors INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  avg_order_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, marketplace, report_month, report_year)
);

ALTER TABLE public.marketplace_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read marketplace_reports"
  ON public.marketplace_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert marketplace_reports"
  ON public.marketplace_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update marketplace_reports"
  ON public.marketplace_reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete marketplace_reports"
  ON public.marketplace_reports FOR DELETE TO authenticated USING (true);
