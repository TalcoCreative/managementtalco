CREATE OR REPLACE FUNCTION public.recalculate_late_status(thresh_hour integer, thresh_minute integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE attendance
  SET late_status = CASE
    WHEN EXTRACT(HOUR FROM clock_in AT TIME ZONE 'Asia/Jakarta') > thresh_hour THEN 'Late'
    WHEN EXTRACT(HOUR FROM clock_in AT TIME ZONE 'Asia/Jakarta') = thresh_hour 
         AND EXTRACT(MINUTE FROM clock_in AT TIME ZONE 'Asia/Jakarta') > thresh_minute THEN 'Late'
    ELSE 'On Time'
  END
  WHERE clock_in IS NOT NULL;
END;
$$;