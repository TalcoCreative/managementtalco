-- Office locations table
CREATE TABLE public.office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (radius_meters BETWEEN 10 AND 5000),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read active locations (needed for clock-in validation)
CREATE POLICY "Authenticated users can view office locations"
ON public.office_locations FOR SELECT
TO authenticated
USING (true);

-- Only super_admin can manage
CREATE POLICY "Super admin can insert office locations"
ON public.office_locations FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can update office locations"
ON public.office_locations FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can delete office locations"
ON public.office_locations FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_office_locations_updated_at
BEFORE UPDATE ON public.office_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add location columns to attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS clock_in_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS clock_in_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_status TEXT CHECK (location_status IN ('inside','outside')),
  ADD COLUMN IF NOT EXISTS matched_location_id UUID REFERENCES public.office_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matched_location_name TEXT,
  ADD COLUMN IF NOT EXISTS outside_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_location_status ON public.attendance(location_status);
CREATE INDEX IF NOT EXISTS idx_attendance_date_clockin ON public.attendance(date DESC, clock_in DESC);

-- Seed the global toggle setting
INSERT INTO public.company_settings (setting_key, setting_value)
VALUES ('location_validation_enabled', 'false')
ON CONFLICT (setting_key) DO NOTHING;