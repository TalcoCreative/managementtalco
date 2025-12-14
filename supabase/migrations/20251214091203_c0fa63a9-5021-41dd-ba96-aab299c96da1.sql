-- Add emergency contact and bank account columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN emergency_contact text,
ADD COLUMN bank_account_number text,
ADD COLUMN bank_account_name text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.emergency_contact IS 'Emergency contact phone number';
COMMENT ON COLUMN public.profiles.bank_account_number IS 'Bank account number for salary transfer';
COMMENT ON COLUMN public.profiles.bank_account_name IS 'Bank account holder name';