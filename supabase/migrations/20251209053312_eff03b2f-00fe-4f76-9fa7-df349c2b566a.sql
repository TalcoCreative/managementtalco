-- Drop existing HR-only insert policy
DROP POLICY IF EXISTS "HR can create tasks" ON public.tasks;

-- Create new policy allowing all authenticated users to create tasks
CREATE POLICY "All authenticated users can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (auth.uid() = created_by);