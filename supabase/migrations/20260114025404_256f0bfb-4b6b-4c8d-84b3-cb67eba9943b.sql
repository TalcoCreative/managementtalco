-- Add temperature column to prospects table
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS temperature text DEFAULT 'warm';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_prospects_temperature ON public.prospects(temperature);

-- Create prospect activity log table for full history including all changes
CREATE TABLE IF NOT EXISTS public.prospect_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  description text,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on prospect_activity_logs
ALTER TABLE public.prospect_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prospect_activity_logs
CREATE POLICY "Users can view all prospect activity logs" 
ON public.prospect_activity_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create prospect activity logs" 
ON public.prospect_activity_logs 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_prospect_activity_logs_prospect_id ON public.prospect_activity_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_activity_logs_created_at ON public.prospect_activity_logs(created_at DESC);