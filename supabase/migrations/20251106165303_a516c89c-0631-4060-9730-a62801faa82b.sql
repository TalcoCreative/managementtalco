-- Add foreign key constraints for assigned_to columns
ALTER TABLE public.projects
ADD CONSTRAINT fk_projects_assigned_to
FOREIGN KEY (assigned_to) REFERENCES public.profiles(id)
ON DELETE SET NULL;

ALTER TABLE public.tasks
ADD CONSTRAINT fk_tasks_assigned_to
FOREIGN KEY (assigned_to) REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- Add foreign key constraint for created_by in tasks
ALTER TABLE public.tasks
ADD CONSTRAINT fk_tasks_created_by
FOREIGN KEY (created_by) REFERENCES public.profiles(id)
ON DELETE CASCADE;