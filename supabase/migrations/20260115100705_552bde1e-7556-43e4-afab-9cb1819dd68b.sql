-- Create candidate_notifications table
CREATE TABLE public.candidate_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view their own candidate notifications"
ON public.candidate_notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own candidate notifications"
ON public.candidate_notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: System can insert notifications (via trigger)
CREATE POLICY "System can insert candidate notifications"
ON public.candidate_notifications
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Create function to notify HR and super_admin when a new candidate is inserted
CREATE OR REPLACE FUNCTION public.notify_hr_on_new_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hr_user RECORD;
  candidate_name TEXT;
  candidate_position TEXT;
BEGIN
  candidate_name := NEW.full_name;
  candidate_position := NEW.position;
  
  -- Insert notification for all HR and super_admin users
  FOR hr_user IN 
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('hr', 'super_admin')
  LOOP
    INSERT INTO public.candidate_notifications (user_id, candidate_id, message)
    VALUES (
      hr_user.user_id,
      NEW.id,
      'Kandidat baru: ' || candidate_name || ' melamar posisi ' || candidate_position
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_notify_hr_on_new_candidate
AFTER INSERT ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.notify_hr_on_new_candidate();

-- Enable realtime for candidate_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_notifications;