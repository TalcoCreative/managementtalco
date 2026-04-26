
-- =========================================================
-- SALES PROSPECT, COMMISSION & WITHDRAWAL SYSTEM
-- =========================================================

-- 1) Extend prospects with deal fields
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS final_value NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS deal_status TEXT;

-- Backfill owner_id from created_by for legacy rows
UPDATE public.prospects SET owner_id = created_by WHERE owner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_owner_id ON public.prospects(owner_id);

-- 2) Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  default_commission_percentage NUMERIC(5,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospects
  ADD CONSTRAINT prospects_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view products"
  ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage products"
  ON public.products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Commission settings (global + per user defaults)
CREATE TABLE IF NOT EXISTS public.commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.commission_settings (setting_key, setting_value)
VALUES ('default_commission_percentage', '10')
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read commission settings"
  ON public.commission_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manages commission settings"
  ON public.commission_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 4) Commission rules (priority: user+product > product > user > global)
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  commission_percentage NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commission_rules_scope_check CHECK (user_id IS NOT NULL OR product_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_rules_unique
  ON public.commission_rules (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read commission rules"
  ON public.commission_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manages commission rules"
  ON public.commission_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER set_commission_rules_updated_at BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Commissions table
CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  sales_id UUID NOT NULL REFERENCES public.profiles(id),
  product_id UUID REFERENCES public.products(id),
  deal_value NUMERIC(15,2) NOT NULL,
  commission_percentage NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | paid
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  CONSTRAINT commissions_prospect_unique UNIQUE (prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_commissions_sales_id ON public.commissions(sales_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales view own commissions, admin all"
  ON public.commissions FOR SELECT TO authenticated
  USING (sales_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin manages commissions"
  ON public.commissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 6) Withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_id UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'requested', -- requested | approved | rejected | paid
  notes TEXT,
  admin_notes TEXT,
  request_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_date TIMESTAMPTZ,
  processed_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_sales_id ON public.withdrawals(sales_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales view own withdrawals, admin all"
  ON public.withdrawals FOR SELECT TO authenticated
  USING (sales_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Sales create own withdrawal request"
  ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (sales_id = auth.uid());

CREATE POLICY "Super admin updates withdrawals"
  ON public.withdrawals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin deletes withdrawals"
  ON public.withdrawals FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 7) Resolve effective commission percentage
CREATE OR REPLACE FUNCTION public.resolve_commission_percentage(_user_id UUID, _product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pct NUMERIC;
BEGIN
  -- 1. user + product
  IF _user_id IS NOT NULL AND _product_id IS NOT NULL THEN
    SELECT commission_percentage INTO pct
    FROM commission_rules
    WHERE user_id = _user_id AND product_id = _product_id
    LIMIT 1;
    IF pct IS NOT NULL THEN RETURN pct; END IF;
  END IF;

  -- 2. product default
  IF _product_id IS NOT NULL THEN
    SELECT default_commission_percentage INTO pct FROM products WHERE id = _product_id;
    IF pct IS NOT NULL THEN RETURN pct; END IF;
  END IF;

  -- 3. user default (rule with product NULL)
  IF _user_id IS NOT NULL THEN
    SELECT commission_percentage INTO pct
    FROM commission_rules
    WHERE user_id = _user_id AND product_id IS NULL
    LIMIT 1;
    IF pct IS NOT NULL THEN RETURN pct; END IF;
  END IF;

  -- 4. global
  SELECT setting_value::NUMERIC INTO pct
  FROM commission_settings
  WHERE setting_key = 'default_commission_percentage';
  RETURN COALESCE(pct, 10);
END;
$$;

-- 8) Auto-generate commission when prospect Won + Paid
CREATE OR REPLACE FUNCTION public.handle_prospect_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pct NUMERIC;
  amt NUMERIC;
  sid UUID;
BEGIN
  IF NEW.status = 'won' AND NEW.deal_status = 'paid' AND NEW.final_value IS NOT NULL THEN
    sid := COALESCE(NEW.owner_id, NEW.created_by);
    pct := resolve_commission_percentage(sid, NEW.product_id);
    amt := ROUND(NEW.final_value * pct / 100, 2);

    INSERT INTO commissions (prospect_id, sales_id, product_id, deal_value, commission_percentage, commission_amount, status)
    VALUES (NEW.id, sid, NEW.product_id, NEW.final_value, pct, amt, 'pending')
    ON CONFLICT (prospect_id) DO UPDATE
      SET deal_value = EXCLUDED.deal_value,
          commission_percentage = EXCLUDED.commission_percentage,
          commission_amount = EXCLUDED.commission_amount,
          product_id = EXCLUDED.product_id,
          sales_id = EXCLUDED.sales_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospect_commission_trigger ON public.prospects;
CREATE TRIGGER prospect_commission_trigger
  AFTER INSERT OR UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.handle_prospect_commission();

-- 9) Tighten prospects RLS so sales only see their own
DROP POLICY IF EXISTS "Authorized users can view prospects" ON public.prospects;
CREATE POLICY "Prospects visibility by role"
  ON public.prospects FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'marketing'::app_role)
    OR has_dynamic_perm(auth.uid(), 'prospects'::text, 'can_view'::text)
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
    OR pic_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authorized users can update prospects" ON public.prospects;
CREATE POLICY "Prospects update by role or owner"
  ON public.prospects FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR created_by = auth.uid()
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_dynamic_perm(auth.uid(), 'prospects'::text, 'can_edit'::text)
  );
