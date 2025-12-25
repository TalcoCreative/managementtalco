-- Add break tracking columns to attendance table
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS break_start timestamptz,
ADD COLUMN IF NOT EXISTS break_end timestamptz,
ADD COLUMN IF NOT EXISTS total_break_minutes integer DEFAULT 0;

-- Create auto-clockout notifications table
CREATE TABLE IF NOT EXISTS public.auto_clockout_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_clockout_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for auto_clockout_notifications
CREATE POLICY "Users can view their own auto-clockout notifications"
ON public.auto_clockout_notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own auto-clockout notifications"
ON public.auto_clockout_notifications
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "System can insert auto-clockout notifications"
ON public.auto_clockout_notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their own auto-clockout notifications"
ON public.auto_clockout_notifications
FOR DELETE
USING (user_id = auth.uid());