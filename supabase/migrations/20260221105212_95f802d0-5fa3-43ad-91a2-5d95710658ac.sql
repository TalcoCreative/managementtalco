
-- Table to log every task status change with timestamps
CREATE TABLE public.task_status_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_task_status_logs_task_id ON public.task_status_logs(task_id);
CREATE INDEX idx_task_status_logs_changed_at ON public.task_status_logs(changed_at);
CREATE INDEX idx_task_status_logs_changed_by ON public.task_status_logs(changed_by);

-- Enable RLS
ALTER TABLE public.task_status_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read logs
CREATE POLICY "Authenticated users can read task status logs"
ON public.task_status_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

-- All authenticated users can insert logs
CREATE POLICY "Authenticated users can insert task status logs"
ON public.task_status_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger function to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_status_logs (task_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to tasks table
CREATE TRIGGER trigger_log_task_status_change
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_status_change();

-- Also log initial creation
CREATE OR REPLACE FUNCTION public.log_task_initial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.task_status_logs (task_id, old_status, new_status, changed_by)
  VALUES (NEW.id, NULL, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_task_initial_status
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_initial_status();
