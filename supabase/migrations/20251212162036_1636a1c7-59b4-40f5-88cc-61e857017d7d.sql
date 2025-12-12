-- Add freelancer fields to shooting_crew
ALTER TABLE public.shooting_crew 
ADD COLUMN is_freelance boolean DEFAULT false,
ADD COLUMN freelance_name text,
ADD COLUMN freelance_cost numeric;

-- Make user_id nullable for freelancers
ALTER TABLE public.shooting_crew ALTER COLUMN user_id DROP NOT NULL;

-- Create shooting notifications table
CREATE TABLE public.shooting_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shooting_id UUID NOT NULL REFERENCES public.shooting_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.shooting_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.shooting_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications
CREATE POLICY "Users can update their own notifications"
ON public.shooting_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Shooting requester can create notifications
CREATE POLICY "Shooting requester can create notifications"
ON public.shooting_notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shooting_schedules
    WHERE id = shooting_id AND requested_by = auth.uid()
  )
);

-- HR and super admin can view all notifications
CREATE POLICY "HR and super admin can view all notifications"
ON public.shooting_notifications
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));