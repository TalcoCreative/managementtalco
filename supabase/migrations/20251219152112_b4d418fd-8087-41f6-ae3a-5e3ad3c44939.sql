-- Add is_confidential column to letters table
ALTER TABLE public.letters ADD COLUMN is_confidential BOOLEAN NOT NULL DEFAULT false;