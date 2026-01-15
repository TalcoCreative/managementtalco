-- Drop existing check constraint and add new one with 'wfh' type
ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_holiday_type_check;

ALTER TABLE public.holidays ADD CONSTRAINT holidays_holiday_type_check 
  CHECK (holiday_type IN ('national', 'office', 'special', 'wfh'));