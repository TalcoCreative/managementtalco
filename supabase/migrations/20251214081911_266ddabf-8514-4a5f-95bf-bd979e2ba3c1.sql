-- Add foreign key for deletion_logs
ALTER TABLE public.deletion_logs
ADD CONSTRAINT deletion_logs_deleted_by_fkey
FOREIGN KEY (deleted_by) REFERENCES public.profiles(id);