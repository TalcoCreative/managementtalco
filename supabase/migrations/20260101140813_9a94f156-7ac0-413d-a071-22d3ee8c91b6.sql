-- Add share_token column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Add share_token column to shooting_schedules table
ALTER TABLE public.shooting_schedules ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Add share_token column to meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON public.projects(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shooting_schedules_share_token ON public.shooting_schedules(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_share_token ON public.meetings(share_token) WHERE share_token IS NOT NULL;