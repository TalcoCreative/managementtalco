ALTER TABLE public.clients ADD COLUMN quota_tracking_start date;
CREATE OR REPLACE FUNCTION public.client_delivery_summary(p_client_id uuid, p_start date, p_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c public.clients%ROWTYPE;
  history jsonb;
BEGIN
  SELECT * INTO c FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client unavailable'; END IF;
  IF p_end < p_start THEN RAISE EXCEPTION 'Invalid period'; END IF;
  IF c.quota_tracking_start IS NOT NULL AND p_end < c.quota_tracking_start THEN
    RETURN jsonb_build_object('actual','{}'::jsonb,'prior_targets','{}'::jsonb,'prior_actual','{}'::jsonb,'previous_targets','{}'::jsonb,'previous_actual','{}'::jsonb,'skipped',true);
  END IF;
  WITH months AS (
    SELECT d::date month_start FROM generate_series(date_trunc('month',c.quota_tracking_start::timestamp)-interval '1 month',date_trunc('month',p_start::timestamp),interval '1 month') d
  ), boundaries AS (
    SELECT month_start + (least(c.quota_cycle_day,extract(day FROM month_start+interval '1 month - 1 day')::integer)-1) start_date,
      (month_start+interval '1 month')::date + (least(c.quota_cycle_day,extract(day FROM month_start+interval '2 months - 1 day')::integer)-1) - 1 end_date FROM months
  ), periods AS (
    SELECT b.*,coalesce(q.targets,c.quota_default_targets) targets
    FROM boundaries b LEFT JOIN public.client_quota_periods q ON q.client_id=c.id AND q.period_start=b.start_date AND q.period_end=b.end_date
    WHERE b.end_date>=c.quota_tracking_start AND b.end_date<p_start
  ), values_by_period AS MATERIALIZED (
    SELECT p.*,public.client_delivery_actuals(c.id,greatest(p.start_date,c.quota_tracking_start),p.end_date) actual,
      max(p.end_date) OVER () last_end FROM periods p
  ), metrics AS (
    SELECT v.end_date,v.last_end,k.key,coalesce((v.targets->>k.key)::numeric,0) target,coalesce((v.actual->>k.key)::numeric,0) actual
    FROM values_by_period v CROSS JOIN LATERAL (
      SELECT jsonb_object_keys(v.targets) key UNION SELECT jsonb_object_keys(v.actual) key
    ) k WHERE k.key<>'partial_reports'
  ), totals AS (
    SELECT key,sum(target) target,sum(actual) actual,
      coalesce(sum(target) FILTER(WHERE end_date=last_end),0) previous_target,
      coalesce(sum(actual) FILTER(WHERE end_date=last_end),0) previous_actual
    FROM metrics GROUP BY key
  ) SELECT jsonb_build_object(
    'prior_targets',coalesce(jsonb_object_agg(key,target),'{}'::jsonb),
    'prior_actual',coalesce(jsonb_object_agg(key,actual),'{}'::jsonb),
    'previous_targets',coalesce(jsonb_object_agg(key,previous_target),'{}'::jsonb),
    'previous_actual',coalesce(jsonb_object_agg(key,previous_actual),'{}'::jsonb)
  ) INTO history FROM totals;
  RETURN history || jsonb_build_object('actual',public.client_delivery_actuals(c.id,greatest(p_start,coalesce(c.quota_tracking_start,p_start)),p_end),'skipped',false);
END $$;
REVOKE ALL ON FUNCTION public.client_delivery_summary(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_delivery_summary(uuid,date,date) TO authenticated,service_role;