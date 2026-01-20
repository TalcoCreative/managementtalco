-- Drop the existing check constraint and add a new one that includes 'meta'
ALTER TABLE public.monthly_ads_reports DROP CONSTRAINT IF EXISTS monthly_ads_reports_platform_check;

ALTER TABLE public.monthly_ads_reports ADD CONSTRAINT monthly_ads_reports_platform_check 
CHECK (platform IN ('instagram', 'facebook', 'meta', 'linkedin', 'tiktok', 'google', 'twitter', 'youtube'));