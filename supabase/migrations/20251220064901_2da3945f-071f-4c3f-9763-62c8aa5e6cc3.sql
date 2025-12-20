-- Create table for public task comments
CREATE TABLE public.task_public_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  commenter_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_public_comments ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view comments on shared tasks
CREATE POLICY "Anyone can view comments on shared tasks" 
ON public.task_public_comments 
FOR SELECT 
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_public_comments.task_id 
    AND tasks.share_token IS NOT NULL
  )
);

-- Allow anyone to add comments on shared tasks
CREATE POLICY "Anyone can add comments on shared tasks" 
ON public.task_public_comments 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_public_comments.task_id 
    AND tasks.share_token IS NOT NULL
  )
);