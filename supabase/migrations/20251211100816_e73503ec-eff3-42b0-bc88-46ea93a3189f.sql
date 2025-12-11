-- Add link column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS link TEXT;