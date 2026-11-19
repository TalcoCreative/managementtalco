ALTER TABLE public.clients ADD COLUMN quota_cycle_day integer NOT NULL DEFAULT 1 CHECK (quota_cycle_day BETWEEN 1 AND 31), ADD COLUMN quota_default_targets jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE public.client_quota_periods (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, period_start date NOT NULL, period_end date NOT NULL, targets jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(client_id,period_start), CHECK(period_end >= period_start));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.client_quota_periods TO authenticated;
GRANT ALL ON public.client_quota_periods TO service_role;
ALTER TABLE public.client_quota_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read client targets" ON public.client_quota_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Client editors create targets" ON public.client_quota_periods FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr') OR public.has_dynamic_perm(auth.uid(),'clients','can_edit'));
CREATE POLICY "Client editors update targets" ON public.client_quota_periods FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr') OR public.has_dynamic_perm(auth.uid(),'clients','can_edit')) WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr') OR public.has_dynamic_perm(auth.uid(),'clients','can_edit'));
CREATE POLICY "Client editors delete targets" ON public.client_quota_periods FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'hr') OR public.has_dynamic_perm(auth.uid(),'clients','can_edit'));
CREATE OR REPLACE FUNCTION public.client_delivery_actuals(p_client_id uuid,p_start date,p_end date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH slides AS (SELECT s.format FROM public.editorial_slides s JOIN public.editorial_plans ep ON ep.id=s.ep_id WHERE ep.client_id=p_client_id AND s.status='published' AND coalesce(s.publish_date,(s.published_at AT TIME ZONE 'Asia/Jakarta')::date) BETWEEN p_start AND p_end),
reports AS (SELECT r.id,r.start_date,r.end_date,make_date(r.report_year,r.report_month,1) month_start,r.results,r.objective FROM public.monthly_ads_reports r WHERE r.client_id=p_client_id),
organic AS (SELECT r.id,r.start_date,r.end_date,make_date(r.report_year,r.report_month,1) month_start FROM public.monthly_organic_reports r JOIN public.platform_accounts a ON a.id=r.platform_account_id WHERE a.client_id=p_client_id)
SELECT jsonb_build_object(
'graphics',(SELECT count(*) FROM slides WHERE format IN ('single_post','feed','carousel')),
'feeds',(SELECT count(*) FROM slides WHERE format IN ('single_post','feed')),
'carousel',(SELECT count(*) FROM slides WHERE format='carousel'),
'shorts',(SELECT count(*) FROM slides WHERE format IN ('shorts','reels')),
'story',(SELECT count(*) FROM slides WHERE format='story'),
'long_video',(SELECT count(*) FROM slides WHERE format='long_video'),
'other_content',(SELECT count(*) FROM slides WHERE coalesce(format,'') NOT IN ('single_post','feed','carousel','shorts','reels','story','long_video')),
'shooting',(SELECT count(*) FROM public.shooting_schedules WHERE client_id=p_client_id AND (completion_status='completed' OR status='completed') AND scheduled_date::date BETWEEN p_start AND p_end),
'meeting',(SELECT count(*) FROM public.meetings WHERE client_id=p_client_id AND completion_status='completed' AND meeting_date BETWEEN p_start AND p_end),
'report',(SELECT count(*) FROM reports WHERE coalesce(start_date,month_start)>=p_start AND coalesce(end_date,(month_start+interval '1 month - 1 day')::date)<=p_end)+(SELECT count(*) FROM organic WHERE coalesce(start_date,month_start)>=p_start AND coalesce(end_date,(month_start+interval '1 month - 1 day')::date)<=p_end),
'ads_spend',coalesce((SELECT sum(t.amount) FROM public.ads_budget_transactions t JOIN public.ads_budgets b ON b.id=t.budget_id WHERE b.client_id=p_client_id AND t.transaction_type='ads_spend' AND t.transaction_date BETWEEN p_start AND p_end),0),
'leads',coalesce((SELECT sum(results) FROM reports WHERE objective='leads' AND coalesce(start_date,month_start)>=p_start AND coalesce(end_date,(month_start+interval '1 month - 1 day')::date)<=p_end),0),
'partial_reports',(SELECT count(*) FROM reports WHERE coalesce(start_date,month_start)<=p_end AND coalesce(end_date,(month_start+interval '1 month - 1 day')::date)>=p_start AND NOT(coalesce(start_date,month_start)>=p_start AND coalesce(end_date,(month_start+interval '1 month - 1 day')::date)<=p_end))+(SELECT count(*) FROM organic WHERE coalesce(start_date,month_start)<=p_end AND coalesce(end_date,(month_start+interval '1 month - 1 day')::date)>=p_start AND NOT(coalesce(start_date,month_start)>=p_start AND coalesce(end_date,(month_start+interval '1 month - 1 day')::date)<=p_end))
) $$;
REVOKE ALL ON FUNCTION public.client_delivery_actuals(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_delivery_actuals(uuid,date,date) TO authenticated,service_role;