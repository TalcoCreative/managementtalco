-- Drop the existing check constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add new check constraint with all valid status values
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'revise', 'todo', 'done', 'writing', 'editing', 'posting'));