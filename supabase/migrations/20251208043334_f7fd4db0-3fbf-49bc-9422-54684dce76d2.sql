-- Add foreign key constraints for tasks to profiles
ALTER TABLE public.tasks
ADD CONSTRAINT fk_tasks_assigned_to_profiles
FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);

ALTER TABLE public.tasks
ADD CONSTRAINT fk_tasks_created_by_profiles
FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- Add foreign key constraints for attendance to profiles
ALTER TABLE public.attendance
ADD CONSTRAINT fk_attendance_user_profiles
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Add foreign key constraints for shooting_schedules to profiles
ALTER TABLE public.shooting_schedules
ADD CONSTRAINT fk_shooting_requested_by_profiles
FOREIGN KEY (requested_by) REFERENCES public.profiles(id);

ALTER TABLE public.shooting_schedules
ADD CONSTRAINT fk_shooting_runner_profiles
FOREIGN KEY (runner) REFERENCES public.profiles(id);

ALTER TABLE public.shooting_schedules
ADD CONSTRAINT fk_shooting_director_profiles
FOREIGN KEY (director) REFERENCES public.profiles(id);

-- Add foreign key constraint for shooting_crew to profiles
ALTER TABLE public.shooting_crew
ADD CONSTRAINT fk_shooting_crew_user_profiles
FOREIGN KEY (user_id) REFERENCES public.profiles(id);