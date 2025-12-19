-- Add foreign key relationship from meeting_minutes.created_by to profiles.id
ALTER TABLE public.meeting_minutes
ADD CONSTRAINT meeting_minutes_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id);