
-- Add client_logo column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_logo TEXT;

-- Create storage bucket for client logos
INSERT INTO storage.buckets (id, name, public) VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for client-logos bucket
CREATE POLICY "Anyone can view client logos" ON storage.objects FOR SELECT USING (bucket_id = 'client-logos');
CREATE POLICY "Authenticated users can upload client logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-logos');
CREATE POLICY "Authenticated users can update client logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'client-logos');
CREATE POLICY "Authenticated users can delete client logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'client-logos');
