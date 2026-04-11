
-- Ads Budgets table
CREATE TABLE public.ads_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_budget NUMERIC NOT NULL DEFAULT 0,
  carry_over NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'safe',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ads_budgets" ON public.ads_budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ads_budgets" ON public.ads_budgets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ads_budgets" ON public.ads_budgets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete ads_budgets" ON public.ads_budgets FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_ads_budgets_updated_at BEFORE UPDATE ON public.ads_budgets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ads Budget Transactions table
CREATE TABLE public.ads_budget_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.ads_budgets(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'ads_spend',
  amount NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_budget_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ads_budget_transactions" ON public.ads_budget_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ads_budget_transactions" ON public.ads_budget_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ads_budget_transactions" ON public.ads_budget_transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete ads_budget_transactions" ON public.ads_budget_transactions FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_ads_budget_transactions_updated_at BEFORE UPDATE ON public.ads_budget_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ads_budgets_client ON public.ads_budgets(client_id);
CREATE INDEX idx_ads_budgets_dates ON public.ads_budgets(start_date, end_date);
CREATE INDEX idx_ads_budget_tx_budget ON public.ads_budget_transactions(budget_id);
CREATE INDEX idx_ads_budget_tx_account ON public.ads_budget_transactions(platform_account_id);
CREATE INDEX idx_ads_budget_tx_date ON public.ads_budget_transactions(transaction_date);
