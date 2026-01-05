-- Client Contracts table
CREATE TABLE public.client_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  file_url TEXT,
  file_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Client Payments table
CREATE TABLE public.client_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'overdue')),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Client Payment Settings table
CREATE TABLE public.client_payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  scheme TEXT NOT NULL DEFAULT 'monthly' CHECK (scheme IN ('monthly', 'termin', 'project_based')),
  payment_day INTEGER,
  total_payments INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Client Quotas table
CREATE TABLE public.client_quotas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL,
  total_quota INTEGER NOT NULL DEFAULT 0,
  used_quota INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, quota_type)
);

-- Client Account Data table (for credentials)
CREATE TABLE public.client_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Client Documents table
CREATE TABLE public.client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Client Activity Logs table
CREATE TABLE public.client_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  changed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS pic_name TEXT,
ADD COLUMN IF NOT EXISTS pic_contact TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Enable RLS on all new tables
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_contracts
CREATE POLICY "Authenticated users can view contracts" ON public.client_contracts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contracts" ON public.client_contracts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contracts" ON public.client_contracts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete contracts" ON public.client_contracts
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for client_payments
CREATE POLICY "Authenticated users can view payments" ON public.client_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert payments" ON public.client_payments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payments" ON public.client_payments
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete payments" ON public.client_payments
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for client_payment_settings
CREATE POLICY "Authenticated users can view payment settings" ON public.client_payment_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert payment settings" ON public.client_payment_settings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payment settings" ON public.client_payment_settings
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for client_quotas
CREATE POLICY "Authenticated users can view quotas" ON public.client_quotas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert quotas" ON public.client_quotas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update quotas" ON public.client_quotas
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete quotas" ON public.client_quotas
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for client_accounts (more restrictive - sensitive data)
CREATE POLICY "Authenticated users can view accounts" ON public.client_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert accounts" ON public.client_accounts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update accounts" ON public.client_accounts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete accounts" ON public.client_accounts
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for client_documents
CREATE POLICY "Authenticated users can view documents" ON public.client_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert documents" ON public.client_documents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update documents" ON public.client_documents
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete documents" ON public.client_documents
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for client_activity_logs
CREATE POLICY "Authenticated users can view activity logs" ON public.client_activity_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert activity logs" ON public.client_activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create storage bucket for client files
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for client files
CREATE POLICY "Authenticated users can view client files"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload client files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'client-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete client files"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-files' AND auth.uid() IS NOT NULL);

-- Function to log client activities
CREATE OR REPLACE FUNCTION public.log_client_activity(
  p_client_id UUID,
  p_action TEXT,
  p_description TEXT,
  p_changed_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.client_activity_logs (client_id, action, description, changed_by)
  VALUES (p_client_id, p_action, p_description, p_changed_by)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;