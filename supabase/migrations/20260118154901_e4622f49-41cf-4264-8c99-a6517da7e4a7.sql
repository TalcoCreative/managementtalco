-- Fix shooting_schedules status constraint to include 'cancelled'
ALTER TABLE shooting_schedules 
DROP CONSTRAINT shooting_schedules_status_check;

ALTER TABLE shooting_schedules 
ADD CONSTRAINT shooting_schedules_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]));

-- Add lead_category column to monthly_ads_reports
ALTER TABLE monthly_ads_reports 
ADD COLUMN IF NOT EXISTS lead_category TEXT DEFAULT NULL;