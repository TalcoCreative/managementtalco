
-- Create task_watchers table for additional notification recipients
CREATE TABLE public.task_watchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;

-- Policies - authenticated users can manage watchers
CREATE POLICY "Authenticated users can view task watchers"
ON public.task_watchers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert task watchers"
ON public.task_watchers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete task watchers"
ON public.task_watchers FOR DELETE
TO authenticated
USING (true);

-- Index for fast lookups
CREATE INDEX idx_task_watchers_task_id ON public.task_watchers(task_id);
CREATE INDEX idx_task_watchers_user_id ON public.task_watchers(user_id);
