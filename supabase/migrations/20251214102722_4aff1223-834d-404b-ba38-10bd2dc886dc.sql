-- Add salary breakdown columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gaji_pokok numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tj_transport numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tj_internet numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tj_kpi numeric DEFAULT 0;