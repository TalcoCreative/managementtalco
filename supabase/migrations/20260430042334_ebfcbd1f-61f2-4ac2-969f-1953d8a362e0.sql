-- ===========================================================
-- 1. PROSPECTS: lock final_value after admin confirmation
-- ===========================================================
CREATE OR REPLACE FUNCTION public.lock_prospect_final_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If already approved as won, prevent changing final_value (unless super_admin)
  IF OLD.won_approved_at IS NOT NULL
     AND OLD.final_value IS DISTINCT FROM NEW.final_value
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'final_value is locked once admin has confirmed the won deal';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_prospect_final_value_trg ON public.prospects;
CREATE TRIGGER lock_prospect_final_value_trg
BEFORE UPDATE ON public.prospects
FOR EACH ROW EXECUTE FUNCTION public.lock_prospect_final_value();

-- ===========================================================
-- 2. EDITORIAL PLANS: add project link + period dates
-- ===========================================================
ALTER TABLE public.editorial_plans
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;

CREATE INDEX IF NOT EXISTS idx_editorial_plans_project ON public.editorial_plans(project_id);

-- Allow EP creators / admins to delete editorial plans
DROP POLICY IF EXISTS "Delete editorial plans" ON public.editorial_plans;
CREATE POLICY "Delete editorial plans"
ON public.editorial_plans
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_dynamic_perm(auth.uid(), 'editorial_plan'::text, 'can_delete'::text)
);

-- ===========================================================
-- 3. MEETINGS: completion tracking
-- ===========================================================
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS completion_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completion_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_notes text;

-- Backfill old meetings already marked completed/cancelled
UPDATE public.meetings
SET completion_status = CASE
  WHEN status IN ('completed','done') THEN 'completed'
  WHEN status = 'cancelled' THEN 'cancelled'
  WHEN status = 'rescheduled' THEN 'rescheduled'
  ELSE 'pending'
END
WHERE completion_status IS NULL OR completion_status = 'pending';

-- ===========================================================
-- 4. SHOOTINGS: completion tracking
-- ===========================================================
ALTER TABLE public.shooting_schedules
  ADD COLUMN IF NOT EXISTS completion_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completion_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_notes text;

-- ===========================================================
-- 5. INVOICE RECURRING
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.invoice_recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- source invoice (template-of-truth: items, bill_to, template, etc.)
  source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  -- denormalized snapshot for resilience
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  interval_unit text NOT NULL CHECK (interval_unit IN ('weekly','monthly','yearly')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count >= 1),

  start_date date NOT NULL,
  next_run_date date NOT NULL,
  end_date date,
  max_occurrences integer,
  occurrences_generated integer NOT NULL DEFAULT 0,

  is_active boolean NOT NULL DEFAULT true,
  last_generated_at timestamptz,

  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_recurring_active_next
  ON public.invoice_recurring_rules(is_active, next_run_date);

ALTER TABLE public.invoice_recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View recurring rules"
ON public.invoice_recurring_rules FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_dynamic_perm(auth.uid(), 'invoices'::text, 'can_view'::text)
);

CREATE POLICY "Create recurring rules"
ON public.invoice_recurring_rules FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_dynamic_perm(auth.uid(), 'invoices'::text, 'can_create'::text)
  )
);

CREATE POLICY "Update recurring rules"
ON public.invoice_recurring_rules FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_dynamic_perm(auth.uid(), 'invoices'::text, 'can_edit'::text)
);

CREATE POLICY "Delete recurring rules"
ON public.invoice_recurring_rules FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_dynamic_perm(auth.uid(), 'invoices'::text, 'can_delete'::text)
);

CREATE TRIGGER set_invoice_recurring_updated_at
BEFORE UPDATE ON public.invoice_recurring_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link generated invoices back to the rule
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS recurring_rule_id uuid REFERENCES public.invoice_recurring_rules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_recurring_rule ON public.invoices(recurring_rule_id);
