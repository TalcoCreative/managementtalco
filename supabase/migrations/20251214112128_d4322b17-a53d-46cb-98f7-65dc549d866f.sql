-- Add adjustment columns to payroll table
ALTER TABLE public.payroll 
ADD COLUMN IF NOT EXISTS reimburse numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS potongan_terlambat numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS potongan_kasbon numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS adjustment_lainnya numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS adjustment_notes text;

-- Allow finance roles to delete ledger entries
CREATE POLICY "Finance roles can delete ledger entries" 
ON public.ledger_entries 
FOR DELETE 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'finance'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role)
);

-- Allow finance roles to update ledger entries  
CREATE POLICY "Finance roles can update ledger entries"
ON public.ledger_entries
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'finance'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role)
);