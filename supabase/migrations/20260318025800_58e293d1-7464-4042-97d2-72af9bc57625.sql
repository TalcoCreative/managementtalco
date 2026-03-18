
CREATE OR REPLACE FUNCTION public.recalculate_late_status(thresh_hour integer, thresh_minute integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE attendance
  SET late_status = CASE
    WHEN clock_in IS NULL THEN late_status
    WHEN EXTRACT(HOUR FROM clock_in AT TIME ZONE 'Asia/Jakarta') > thresh_hour THEN 'Late'
    WHEN EXTRACT(HOUR FROM clock_in AT TIME ZONE 'Asia/Jakarta') = thresh_hour 
         AND EXTRACT(MINUTE FROM clock_in AT TIME ZONE 'Asia/Jakarta') > thresh_minute THEN 'Late'
    ELSE 'On Time'
  END
  WHERE clock_in IS NOT NULL;
END;
$function$;

-- Also run recalculation now with current threshold
DO $$
DECLARE
  current_threshold TEXT;
  th INTEGER;
  tm INTEGER;
BEGIN
  SELECT setting_value INTO current_threshold
  FROM company_settings
  WHERE setting_key = 'late_threshold_time'
  LIMIT 1;
  
  IF current_threshold IS NOT NULL THEN
    th := SPLIT_PART(current_threshold, ':', 1)::INTEGER;
    tm := SPLIT_PART(current_threshold, ':', 2)::INTEGER;
    PERFORM recalculate_late_status(th, tm);
  END IF;
END $$;
