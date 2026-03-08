
-- Create sub_tasks table
CREATE TABLE public.sub_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sub_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users with dynamic permissions on tasks can manage sub_tasks
CREATE POLICY "Users with task view can view sub_tasks"
  ON public.sub_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    OR public.has_dynamic_perm(auth.uid(), 'tasks', 'can_view')
  );

CREATE POLICY "Users with task create can insert sub_tasks"
  ON public.sub_tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    OR public.has_dynamic_perm(auth.uid(), 'tasks', 'can_create')
  );

CREATE POLICY "Users with task edit can update sub_tasks"
  ON public.sub_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    OR public.has_dynamic_perm(auth.uid(), 'tasks', 'can_edit')
  );

CREATE POLICY "Users with task delete can delete sub_tasks"
  ON public.sub_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    OR public.has_dynamic_perm(auth.uid(), 'tasks', 'can_delete')
  );

-- Index for fast lookup
CREATE INDEX idx_sub_tasks_task_id ON public.sub_tasks(task_id);

-- Trigger for updated_at
CREATE TRIGGER set_sub_tasks_updated_at
  BEFORE UPDATE ON public.sub_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
