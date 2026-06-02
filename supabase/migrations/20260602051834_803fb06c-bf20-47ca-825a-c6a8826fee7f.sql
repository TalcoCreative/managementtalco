CREATE POLICY "Authenticated can view today's team mood"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  date = (now() AT TIME ZONE 'Asia/Jakarta')::date
  AND clock_in IS NOT NULL
);