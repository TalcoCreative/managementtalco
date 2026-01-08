-- Add dashboard_slug column to clients table for public dashboard access
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS dashboard_slug TEXT UNIQUE;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_clients_dashboard_slug ON public.clients(dashboard_slug);

-- Enable realtime for clients to support live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;