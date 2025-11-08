-- Add time tracking columns to tasks table
ALTER TABLE public.tasks
ADD COLUMN requested_at timestamp with time zone DEFAULT now(),
ADD COLUMN assigned_at timestamp with time zone;

-- Create shooting schedules table
CREATE TABLE public.shooting_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  location text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid NOT NULL,
  approved_by uuid,
  runner uuid,
  director uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create shooting crew table (for campers and additional crew)
CREATE TABLE public.shooting_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shooting_id uuid NOT NULL REFERENCES public.shooting_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('camper', 'additional')),
  created_at timestamp with time zone DEFAULT now()
);

-- Create attendance/time tracking table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.shooting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shooting_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shooting_schedules
CREATE POLICY "All authenticated users can view shooting schedules"
ON public.shooting_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create shooting requests"
ON public.shooting_schedules FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "HR and super admin can approve shooting schedules"
ON public.shooting_schedules FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role)
);

-- RLS Policies for shooting_crew
CREATE POLICY "All authenticated users can view shooting crew"
ON public.shooting_crew FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage crew for their shooting requests"
ON public.shooting_crew FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shooting_schedules 
    WHERE id = shooting_crew.shooting_id 
    AND requested_by = auth.uid()
  )
);

-- RLS Policies for attendance
CREATE POLICY "Users can view their own attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own attendance"
ON public.attendance FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "HR and super admin can view all attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role)
);