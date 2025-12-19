-- Create meeting_minutes table for MOM (Minutes of Meeting)
CREATE TABLE public.meeting_minutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view meeting minutes
CREATE POLICY "All authenticated users can view meeting minutes"
ON public.meeting_minutes
FOR SELECT
USING (true);

-- Meeting creator and HR can create meeting minutes
CREATE POLICY "Meeting creator and HR can create meeting minutes"
ON public.meeting_minutes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = meeting_minutes.meeting_id 
    AND (meetings.created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  )
);

-- Meeting creator and HR can update meeting minutes
CREATE POLICY "Meeting creator and HR can update meeting minutes"
ON public.meeting_minutes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = meeting_minutes.meeting_id 
    AND (meetings.created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  )
);

-- Meeting creator and HR can delete meeting minutes
CREATE POLICY "Meeting creator and HR can delete meeting minutes"
ON public.meeting_minutes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.meetings 
    WHERE meetings.id = meeting_minutes.meeting_id 
    AND (meetings.created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
  )
);

-- Add reschedule columns to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS original_date DATE,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMP WITH TIME ZONE;