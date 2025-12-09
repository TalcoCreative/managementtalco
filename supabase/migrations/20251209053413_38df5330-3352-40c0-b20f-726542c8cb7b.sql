-- Add foreign key from comments.author_id to profiles.id
ALTER TABLE public.comments
ADD CONSTRAINT fk_comments_author_profiles
FOREIGN KEY (author_id) REFERENCES public.profiles(id);

-- Add foreign key from task_attachments.uploaded_by to profiles.id
ALTER TABLE public.task_attachments
ADD CONSTRAINT fk_task_attachments_uploader_profiles
FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);