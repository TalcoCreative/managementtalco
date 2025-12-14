-- Create deletion_logs table to store deletion reasons and notify HR
CREATE TABLE public.deletion_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'client', 'task', 'project', 'shooting'
    entity_id UUID NOT NULL,
    entity_name TEXT NOT NULL,
    deleted_by UUID NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    viewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.deletion_logs ENABLE ROW LEVEL SECURITY;

-- HR and super admin can view all deletion logs
CREATE POLICY "HR and super admin can view deletion logs"
ON public.deletion_logs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- Authenticated users can create deletion logs
CREATE POLICY "Authenticated users can create deletion logs"
ON public.deletion_logs
FOR INSERT
WITH CHECK (auth.uid() = deleted_by);

-- HR and super admin can mark logs as viewed
CREATE POLICY "HR and super admin can update deletion logs"
ON public.deletion_logs
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- Update tasks RLS to allow all users to delete
CREATE POLICY "All authenticated users can delete tasks"
ON public.tasks
FOR DELETE
USING (true);

-- Update projects RLS to allow all users to delete
CREATE POLICY "All authenticated users can delete projects"
ON public.projects
FOR DELETE
USING (true);

-- Create shooting schedules delete policy
CREATE POLICY "All authenticated users can delete shooting schedules"
ON public.shooting_schedules
FOR DELETE
USING (true);