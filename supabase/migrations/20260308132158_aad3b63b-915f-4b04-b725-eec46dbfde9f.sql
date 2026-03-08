
-- Add late_status column to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS late_status TEXT DEFAULT NULL;

-- Seed the late threshold setting
INSERT INTO public.company_settings (setting_key, setting_value)
VALUES ('late_threshold_time', '10:00')
ON CONFLICT (setting_key) DO NOTHING;
