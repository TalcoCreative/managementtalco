-- Create task_assignees table for multiple assignees per task
CREATE TABLE public.task_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_assignees
CREATE POLICY "Everyone can view task assignees" ON public.task_assignees FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert task assignees" ON public.task_assignees FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete task assignees" ON public.task_assignees FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create task_notifications table for notifications to all involved users
CREATE TABLE public.task_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  shooting_id UUID REFERENCES public.shooting_schedules(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'assigned', 'updated', 'status_changed', 'comment', etc.
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_notifications
CREATE POLICY "Users can view their own notifications" ON public.task_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert notifications" ON public.task_notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own notifications" ON public.task_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.task_notifications FOR DELETE USING (auth.uid() = user_id);

-- Add title and description editability tracking
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS title_edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description_edited_at TIMESTAMP WITH TIME ZONE;