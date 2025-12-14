-- Add client_id and project_id to shooting_schedules (required)
ALTER TABLE public.shooting_schedules
ADD COLUMN client_id UUID REFERENCES public.clients(id),
ADD COLUMN project_id UUID REFERENCES public.projects(id),
ADD COLUMN task_id UUID REFERENCES public.tasks(id),
ADD COLUMN rescheduled_from DATE,
ADD COLUMN reschedule_reason TEXT,
ADD COLUMN original_date DATE,
ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN cancel_reason TEXT;

-- Update shooting_notifications to track crew role
ALTER TABLE public.shooting_notifications
ADD COLUMN crew_role TEXT;