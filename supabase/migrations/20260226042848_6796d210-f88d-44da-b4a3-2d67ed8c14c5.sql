-- Add theme column to forms table
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'clean';
