-- Create company_settings table for logo and signature
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- HR and super admin can view settings
CREATE POLICY "HR and super admin can view settings"
ON public.company_settings
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'finance'::app_role) OR
  has_role(auth.uid(), 'accounting'::app_role)
);

-- HR and super admin can manage settings
CREATE POLICY "HR and super admin can manage settings"
ON public.company_settings
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role)
);

-- Insert default settings
INSERT INTO public.company_settings (setting_key, setting_value) 
VALUES 
  ('company_logo', null),
  ('hr_signature', null);

-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company assets
CREATE POLICY "Anyone can view company assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

CREATE POLICY "HR can upload company assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets' AND 
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);

CREATE POLICY "HR can update company assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-assets' AND 
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);

CREATE POLICY "HR can delete company assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-assets' AND 
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))
);