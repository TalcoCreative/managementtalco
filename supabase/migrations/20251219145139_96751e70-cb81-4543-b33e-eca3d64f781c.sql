-- Create assets table (master data)
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  default_location TEXT NOT NULL DEFAULT 'Gudang Pamulang',
  condition TEXT NOT NULL DEFAULT 'baik',
  status TEXT NOT NULL DEFAULT 'available',
  description TEXT,
  qr_code TEXT,
  current_holder_id UUID REFERENCES public.profiles(id),
  current_location TEXT DEFAULT 'Gudang Pamulang',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT assets_condition_check CHECK (condition IN ('baik', 'rusak', 'maintenance')),
  CONSTRAINT assets_status_check CHECK (status IN ('available', 'borrowed', 'lost'))
);

-- Create asset_transactions table (history/log)
CREATE TABLE public.asset_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  checkout_by UUID REFERENCES public.profiles(id),
  used_by UUID REFERENCES public.profiles(id),
  checkin_by UUID REFERENCES public.profiles(id),
  checkout_location TEXT,
  checkin_location TEXT,
  checkout_at TIMESTAMP WITH TIME ZONE,
  checkin_at TIMESTAMP WITH TIME ZONE,
  condition_before TEXT,
  condition_after TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT transaction_type_check CHECK (transaction_type IN ('checkout', 'checkin', 'transfer'))
);

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assets
CREATE POLICY "All authenticated users can view assets"
ON public.assets FOR SELECT USING (true);

CREATE POLICY "Authorized roles can create assets"
ON public.assets FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "All users can update asset status"
ON public.assets FOR UPDATE USING (true);

CREATE POLICY "HR and super admin can delete assets"
ON public.assets FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role)
);

-- RLS Policies for asset_transactions
CREATE POLICY "All authenticated users can view transactions"
ON public.asset_transactions FOR SELECT USING (true);

CREATE POLICY "All authenticated users can create transactions"
ON public.asset_transactions FOR INSERT WITH CHECK (true);

-- Trigger to update updated_at using existing function
CREATE TRIGGER update_assets_updated_at
BEFORE UPDATE ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_category ON public.assets(category);
CREATE INDEX idx_assets_code ON public.assets(code);
CREATE INDEX idx_asset_transactions_asset_id ON public.asset_transactions(asset_id);
CREATE INDEX idx_asset_transactions_checkout_by ON public.asset_transactions(checkout_by);
CREATE INDEX idx_asset_transactions_used_by ON public.asset_transactions(used_by);