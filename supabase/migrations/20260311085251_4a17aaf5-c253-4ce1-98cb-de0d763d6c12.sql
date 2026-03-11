
-- Drop restrictive policies
DROP POLICY IF EXISTS "Assigned users can update their tasks" ON public.tasks;
DROP POLICY IF EXISTS "All authenticated users can create tasks" ON public.tasks;

-- Allow all authenticated users to update tasks
CREATE POLICY "All authenticated users can update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Allow all authenticated users to create tasks (without created_by restriction)
CREATE POLICY "All authenticated users can create tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
