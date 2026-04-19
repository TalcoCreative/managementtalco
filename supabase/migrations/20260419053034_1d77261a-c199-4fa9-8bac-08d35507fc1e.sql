
CREATE TABLE public.invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_code TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0f172a',
  secondary_color TEXT NOT NULL DEFAULT '#64748b',
  company_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_notes TEXT,
  default_terms TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View invoice templates" ON public.invoice_templates FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_dynamic_perm(auth.uid(), 'invoice_templates', 'can_view')
  OR public.has_dynamic_perm(auth.uid(), 'invoices', 'can_view')
);
CREATE POLICY "Create invoice templates" ON public.invoice_templates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_dynamic_perm(auth.uid(), 'invoice_templates', 'can_create'));
CREATE POLICY "Update invoice templates" ON public.invoice_templates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_dynamic_perm(auth.uid(), 'invoice_templates', 'can_edit'));
CREATE POLICY "Delete invoice templates" ON public.invoice_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_dynamic_perm(auth.uid(), 'invoice_templates', 'can_delete'));

CREATE TRIGGER set_invoice_templates_updated_at
BEFORE UPDATE ON public.invoice_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  letter_id UUID REFERENCES public.letters(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.invoice_templates(id) ON DELETE SET NULL,
  template_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_logo_url TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  bill_to_name TEXT NOT NULL,
  bill_to_company TEXT,
  bill_to_address TEXT,
  bill_to_email TEXT,
  bill_to_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  terms TEXT,
  enabled_payment_method_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_template ON public.invoices(template_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View invoices" ON public.invoices FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_dynamic_perm(auth.uid(), 'invoices', 'can_view')
  OR created_by = auth.uid()
);
CREATE POLICY "Create invoices" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'super_admin') OR public.has_dynamic_perm(auth.uid(), 'invoices', 'can_create'))
  AND created_by = auth.uid()
);
CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_dynamic_perm(auth.uid(), 'invoices', 'can_edit')
  OR created_by = auth.uid()
);
CREATE POLICY "Delete invoices" ON public.invoices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_dynamic_perm(auth.uid(), 'invoices', 'can_delete'));

CREATE TRIGGER set_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoice_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View invoice activity" ON public.invoice_activity_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_activity_logs.invoice_id AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_dynamic_perm(auth.uid(), 'invoices', 'can_view')
      OR i.created_by = auth.uid()
    )
  )
);
CREATE POLICY "Insert invoice activity" ON public.invoice_activity_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO public.invoice_templates (name, entity_code, entity_name, primary_color, secondary_color, company_info, payment_methods, default_notes, default_terms, is_default)
VALUES
  ('Talco Studio', 'TS', 'Talco Studio', '#0ea5e9', '#0f172a',
    jsonb_build_object('address','','email','','phone','','website','','tax_id',''),
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text, 'type','bank','label','Bank Transfer','bank_name','','account_name','Talco Studio','account_number','','notes','','enabled', true),
      jsonb_build_object('id', gen_random_uuid()::text, 'type','qris','label','QRIS','qris_image_url','','notes','','enabled', false)
    ),
    'Terima kasih atas kepercayaan Anda kepada Talco Studio.',
    'Pembayaran wajib dilakukan dalam 14 hari sejak tanggal invoice. Konfirmasi pembayaran ke email kami.',
    true),
  ('TalcoWorld', 'TW', 'TalcoWorld', '#8b5cf6', '#0f172a',
    jsonb_build_object('address','','email','','phone','','website','','tax_id',''),
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text, 'type','bank','label','Bank Transfer','bank_name','','account_name','TalcoWorld','account_number','','notes','','enabled', true)
    ),
    'Terima kasih atas kerjasamanya bersama TalcoWorld.',
    'Pembayaran wajib dilakukan dalam 14 hari sejak tanggal invoice.',
    false),
  ('Talco Creative Indonesia', 'TCI', 'Talco Creative Indonesia', '#f59e0b', '#0f172a',
    jsonb_build_object('address','','email','','phone','','website','','tax_id',''),
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text, 'type','bank','label','Bank Transfer','bank_name','','account_name','Talco Creative Indonesia','account_number','','notes','','enabled', true)
    ),
    'Terima kasih atas kepercayaan Anda kepada Talco Creative Indonesia.',
    'Pembayaran wajib dilakukan dalam 14 hari sejak tanggal invoice.',
    false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-assets', 'invoice-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read invoice assets" ON storage.objects FOR SELECT
USING (bucket_id = 'invoice-assets');
CREATE POLICY "Auth upload invoice assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-assets');
CREATE POLICY "Auth update invoice assets" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'invoice-assets');
CREATE POLICY "Auth delete invoice assets" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoice-assets');
