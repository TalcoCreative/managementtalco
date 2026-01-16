-- Add client_type field to clients table
ALTER TABLE public.clients 
ADD COLUMN client_type TEXT NOT NULL DEFAULT 'client';

-- Add check constraint for valid values
ALTER TABLE public.clients 
ADD CONSTRAINT clients_client_type_check 
CHECK (client_type IN ('client', 'internal'));