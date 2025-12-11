-- Add employee detail fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ktp_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_start DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_end DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary DECIMAL(15,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;