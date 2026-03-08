ALTER TABLE public.letters 
  ADD COLUMN IF NOT EXISTS letter_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;