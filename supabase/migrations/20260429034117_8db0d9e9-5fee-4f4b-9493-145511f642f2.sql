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
  target_status TEXT;
BEGIN
  IF NEW.status = 'won'
     AND NEW.final_value IS NOT NULL
     AND NEW.won_approved_at IS NOT NULL THEN
    sid := COALESCE(NEW.owner_id, NEW.created_by, NEW.pic_id);
    pct := resolve_commission_percentage(sid, NEW.product_id);
    amt := ROUND(NEW.final_value * pct / 100, 2);
    target_status := CASE WHEN NEW.deal_status = 'paid' THEN 'paid' ELSE 'approved' END;

    INSERT INTO commissions (prospect_id, sales_id, product_id, deal_value, commission_percentage, commission_amount, status, approved_at, paid_at)
    VALUES (
      NEW.id, sid, NEW.product_id, NEW.final_value, pct, amt, target_status,
      now(),
      CASE WHEN target_status = 'paid' THEN now() ELSE NULL END
    )
    ON CONFLICT (prospect_id) DO UPDATE
      SET deal_value = EXCLUDED.deal_value,
          commission_percentage = EXCLUDED.commission_percentage,
          commission_amount = EXCLUDED.commission_amount,
          product_id = EXCLUDED.product_id,
          sales_id = EXCLUDED.sales_id,
          status = CASE
            WHEN commissions.status = 'paid' THEN 'paid'
            WHEN EXCLUDED.status = 'paid' THEN 'paid'
            ELSE 'approved'
          END,
          approved_at = COALESCE(commissions.approved_at, now()),
          paid_at = CASE
            WHEN commissions.status = 'paid' THEN commissions.paid_at
            WHEN EXCLUDED.status = 'paid' THEN now()
            ELSE commissions.paid_at
          END;
  END IF;
  RETURN NEW;
END;
$function$;