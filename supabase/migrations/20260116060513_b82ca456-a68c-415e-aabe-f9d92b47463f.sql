-- Drop existing constraint and add updated one with 'upcoming'
ALTER TABLE public.clients DROP CONSTRAINT clients_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'upcoming'::text]));