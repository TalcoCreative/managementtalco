-- Add hidden_from_dashboard column to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS hidden_from_dashboard BOOLEAN DEFAULT false;