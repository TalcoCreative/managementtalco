-- Update project type enum to include digital/socmed types
-- First, let's check if we need to add new status values for tasks related to socmed/digital
-- Add new status options for tasks: writing, editing, posting
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('todo', 'in_progress', 'done', 'writing', 'editing', 'posting'));

-- Update default status if needed
COMMENT ON COLUMN public.tasks.status IS 'Task status: todo, in_progress, done, writing, editing, posting';