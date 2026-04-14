
-- Master Wallet Transactions table
CREATE TABLE public.master_wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_date TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.master_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wallet transactions"
ON public.master_wallet_transactions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert wallet transactions"
ON public.master_wallet_transactions FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete wallet transactions"
ON public.master_wallet_transactions FOR DELETE TO authenticated
USING (true);

-- Add assigned_to to editorial_slides
ALTER TABLE public.editorial_slides ADD COLUMN assigned_to UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Add ep_slide_id to tasks for linking
ALTER TABLE public.tasks ADD COLUMN ep_slide_id UUID REFERENCES public.editorial_slides(id) DEFAULT NULL;
