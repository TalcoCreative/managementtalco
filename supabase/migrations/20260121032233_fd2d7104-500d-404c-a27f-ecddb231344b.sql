-- Create pivot table for shooting-task many-to-many relationship
CREATE TABLE public.shooting_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shooting_id UUID NOT NULL REFERENCES public.shooting_schedules(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(shooting_id, task_id)
);

-- Enable RLS
ALTER TABLE public.shooting_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view shooting_tasks"
ON public.shooting_tasks FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert shooting_tasks"
ON public.shooting_tasks FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete shooting_tasks"
ON public.shooting_tasks FOR DELETE
TO authenticated
USING (true);

-- Get current expense categories and add any missing ones
-- First, let's drop and recreate the constraint with all needed categories
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- Add a more flexible constraint or remove it entirely for custom categories
-- Since the app uses dynamic categories from finance-categories.ts, we'll remove the strict check
ALTER TABLE public.expenses ALTER COLUMN category TYPE TEXT;