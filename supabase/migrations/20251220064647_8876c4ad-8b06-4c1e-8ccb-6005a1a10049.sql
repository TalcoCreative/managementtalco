-- Add RLS policy for public access to projects when accessed via shared task
CREATE POLICY "Anyone can view projects for shared tasks" 
ON public.projects 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.project_id = projects.id 
    AND tasks.share_token IS NOT NULL
  )
);

-- Add RLS policy for public access to clients when accessed via shared task
CREATE POLICY "Anyone can view clients for shared tasks" 
ON public.clients 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    JOIN public.tasks ON tasks.project_id = projects.id
    WHERE projects.client_id = clients.id 
    AND tasks.share_token IS NOT NULL
  )
);

-- Add RLS policy for public access to profiles when accessed via shared task (assigned_to)
CREATE POLICY "Anyone can view profiles for shared tasks" 
ON public.profiles 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.assigned_to = profiles.id 
    AND tasks.share_token IS NOT NULL
  )
);