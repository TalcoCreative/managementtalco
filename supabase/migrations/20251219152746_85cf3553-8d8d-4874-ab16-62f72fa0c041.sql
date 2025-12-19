-- Add is_confidential column to meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN NOT NULL DEFAULT false;