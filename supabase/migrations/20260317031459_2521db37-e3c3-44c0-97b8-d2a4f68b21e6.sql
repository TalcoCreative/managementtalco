
-- Add categories to wa_notification_settings
ALTER TABLE public.wa_notification_settings 
ADD COLUMN IF NOT EXISTS send_to_all_users boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS role_filter text[] DEFAULT '{}';

-- Add start_date/end_date to report tables for date-range support
ALTER TABLE public.monthly_organic_reports 
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE public.monthly_ads_reports 
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE public.marketplace_reports 
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date;

-- Update existing wa_notification_settings: set attendance to not send to all, leave_request/recruitment to role_filter
UPDATE public.wa_notification_settings SET send_to_all_users = false WHERE event_type = 'attendance_reminder';
UPDATE public.wa_notification_settings SET role_filter = ARRAY['hr', 'super_admin'] WHERE event_type IN ('leave_request', 'recruitment_new');
