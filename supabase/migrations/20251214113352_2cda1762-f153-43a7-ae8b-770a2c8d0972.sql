-- Add request_type column to reimbursements table
ALTER TABLE public.reimbursements 
ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'reimbursement' CHECK (request_type IN ('reimbursement', 'request'));

-- Add title column for request description
ALTER TABLE public.reimbursements 
ADD COLUMN IF NOT EXISTS title text;