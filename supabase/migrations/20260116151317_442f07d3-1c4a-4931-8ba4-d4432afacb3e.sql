
-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Platform Accounts table
CREATE TABLE public.platform_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'youtube', 'tiktok', 'google_business')),
  account_name TEXT NOT NULL,
  username_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Monthly Organic Reports table
CREATE TABLE public.monthly_organic_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_account_id UUID NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  report_month INTEGER NOT NULL CHECK (report_month >= 1 AND report_month <= 12),
  report_year INTEGER NOT NULL CHECK (report_year >= 2020 AND report_year <= 2100),
  
  -- Instagram metrics
  ig_reach BIGINT,
  ig_impressions BIGINT,
  ig_profile_visits BIGINT,
  ig_website_clicks BIGINT,
  ig_content_interactions BIGINT,
  ig_followers BIGINT,
  
  -- Facebook metrics
  fb_reach BIGINT,
  fb_impressions BIGINT,
  fb_content_interactions BIGINT,
  fb_page_views BIGINT,
  fb_followers BIGINT,
  
  -- LinkedIn metrics
  li_impressions BIGINT,
  li_engagement_rate DECIMAL(5,2),
  li_followers BIGINT,
  li_page_views BIGINT,
  li_unique_visitors BIGINT,
  
  -- YouTube metrics
  yt_views BIGINT,
  yt_watch_time BIGINT,
  yt_impressions BIGINT,
  yt_subscribers BIGINT,
  
  -- TikTok metrics
  tt_video_views BIGINT,
  tt_profile_views BIGINT,
  tt_likes BIGINT,
  tt_comments BIGINT,
  tt_shares BIGINT,
  tt_followers BIGINT,
  
  -- Google Business metrics
  gb_profile_views BIGINT,
  gb_profile_interactions BIGINT,
  gb_direction_requests BIGINT,
  gb_phone_calls BIGINT,
  gb_positive_reviews BIGINT,
  gb_negative_reviews BIGINT,
  
  -- Audit fields
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  
  -- Unique constraint: one report per platform account per month
  UNIQUE(platform_account_id, report_month, report_year)
);

-- Monthly Ads Reports table
CREATE TABLE public.monthly_ads_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'youtube', 'tiktok', 'google_ads')),
  platform_account_id UUID REFERENCES public.platform_accounts(id) ON DELETE SET NULL,
  report_month INTEGER NOT NULL CHECK (report_month >= 1 AND report_month <= 12),
  report_year INTEGER NOT NULL CHECK (report_year >= 2020 AND report_year <= 2100),
  
  -- Mandatory ads fields (spend in IDR)
  total_spend BIGINT NOT NULL CHECK (total_spend >= 0),
  impressions BIGINT NOT NULL DEFAULT 0,
  reach BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  results BIGINT NOT NULL DEFAULT 0,
  
  -- Ads objective
  objective TEXT NOT NULL CHECK (objective IN ('awareness', 'traffic', 'engagement', 'leads', 'conversions', 'video_views')),
  
  -- Performance metrics (calculated or entered)
  cpm DECIMAL(12,2),
  cpc DECIMAL(12,2),
  cost_per_result DECIMAL(12,2),
  
  -- Audit fields
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  
  -- Unique constraint
  UNIQUE(client_id, platform, platform_account_id, report_month, report_year)
);

-- Report Audit Logs table
CREATE TABLE public.report_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('organic', 'ads')),
  report_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'lock', 'unlock')),
  previous_values JSONB,
  new_values JSONB,
  performed_by UUID NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_organic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_ads_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform Accounts policies
CREATE POLICY "All authenticated users can view platform accounts"
ON public.platform_accounts FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can create platform accounts"
ON public.platform_accounts FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can update platform accounts"
ON public.platform_accounts FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can delete platform accounts"
ON public.platform_accounts FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Monthly Organic Reports policies
CREATE POLICY "All authenticated users can view organic reports"
ON public.monthly_organic_reports FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can create organic reports"
ON public.monthly_organic_reports FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own unlocked organic reports"
ON public.monthly_organic_reports FOR UPDATE
USING (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR is_locked = false));

CREATE POLICY "Users can delete their own unlocked organic reports"
ON public.monthly_organic_reports FOR DELETE
USING (auth.uid() IS NOT NULL AND created_by = auth.uid() AND is_locked = false);

-- Monthly Ads Reports policies
CREATE POLICY "All authenticated users can view ads reports"
ON public.monthly_ads_reports FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can create ads reports"
ON public.monthly_ads_reports FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own unlocked ads reports"
ON public.monthly_ads_reports FOR UPDATE
USING (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR is_locked = false));

CREATE POLICY "Users can delete their own unlocked ads reports"
ON public.monthly_ads_reports FOR DELETE
USING (auth.uid() IS NOT NULL AND created_by = auth.uid() AND is_locked = false);

-- Audit Logs policies
CREATE POLICY "All authenticated users can view audit logs"
ON public.report_audit_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can create audit logs"
ON public.report_audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_platform_accounts_updated_at
BEFORE UPDATE ON public.platform_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_organic_reports_updated_at
BEFORE UPDATE ON public.monthly_organic_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_ads_reports_updated_at
BEFORE UPDATE ON public.monthly_ads_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_platform_accounts_client ON public.platform_accounts(client_id);
CREATE INDEX idx_platform_accounts_platform ON public.platform_accounts(platform);
CREATE INDEX idx_organic_reports_account ON public.monthly_organic_reports(platform_account_id);
CREATE INDEX idx_organic_reports_period ON public.monthly_organic_reports(report_year, report_month);
CREATE INDEX idx_ads_reports_client ON public.monthly_ads_reports(client_id);
CREATE INDEX idx_ads_reports_platform ON public.monthly_ads_reports(platform);
CREATE INDEX idx_ads_reports_period ON public.monthly_ads_reports(report_year, report_month);
CREATE INDEX idx_audit_logs_report ON public.report_audit_logs(report_type, report_id);
