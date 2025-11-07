-- Create attachments table for task files and links
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_url TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attachments
CREATE POLICY "All authenticated users can view attachments"
ON public.task_attachments
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can upload attachments"
ON public.task_attachments
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own attachments"
ON public.task_attachments
FOR DELETE
USING (auth.uid() = uploaded_by);

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true);

-- Storage policies for task attachments
CREATE POLICY "Anyone can view task attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own task attachments"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'task-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own task attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);