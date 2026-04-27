ALTER TABLE public.prospects
ADD COLUMN IF NOT EXISTS won_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS won_approved_by UUID;

CREATE OR REPLACE FUNCTION public.handle_prospect_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pct NUMERIC;
  amt NUMERIC;
  sid UUID;
BEGIN
  IF NEW.status = 'won'
     AND NEW.deal_status = 'paid'
     AND NEW.final_value IS NOT NULL
     AND NEW.won_approved_at IS NOT NULL THEN
    sid := COALESCE(NEW.owner_id, NEW.created_by, NEW.pic_id);
    pct := resolve_commission_percentage(sid, NEW.product_id);
    amt := ROUND(NEW.final_value * pct / 100, 2);

    INSERT INTO commissions (prospect_id, sales_id, product_id, deal_value, commission_percentage, commission_amount, status)
    VALUES (NEW.id, sid, NEW.product_id, NEW.final_value, pct, amt, 'approved')
    ON CONFLICT (prospect_id) DO UPDATE
      SET deal_value = EXCLUDED.deal_value,
          commission_percentage = EXCLUDED.commission_percentage,
          commission_amount = EXCLUDED.commission_amount,
          product_id = EXCLUDED.product_id,
          sales_id = EXCLUDED.sales_id,
          status = CASE
            WHEN commissions.status = 'paid' THEN 'paid'
            ELSE 'approved'
          END,
          approved_at = CASE
            WHEN commissions.status = 'paid' THEN commissions.approved_at
            ELSE COALESCE(commissions.approved_at, now())
          END;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.prospects
SET pic_id = COALESCE(pic_id, owner_id, created_by)
WHERE pic_id IS NULL;

UPDATE public.commissions c
SET status = 'approved',
    approved_at = COALESCE(c.approved_at, now())
FROM public.prospects p
WHERE c.prospect_id = p.id
  AND p.status = 'won'
  AND p.deal_status = 'paid'
  AND p.final_value IS NOT NULL
  AND c.status = 'pending';