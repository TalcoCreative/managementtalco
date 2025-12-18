-- Add DELETE policy for task_activities so tasks can be deleted properly
CREATE POLICY "Users can delete their own activities" 
ON public.task_activities 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "HR and super admin can delete activities" 
ON public.task_activities 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));