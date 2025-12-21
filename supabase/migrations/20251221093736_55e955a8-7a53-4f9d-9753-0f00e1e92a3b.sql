-- Add task_id column to meetings table
ALTER TABLE public.meetings 
ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_meetings_task_id ON public.meetings(task_id);