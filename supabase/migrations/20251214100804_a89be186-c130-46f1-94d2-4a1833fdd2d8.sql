-- Add status field to profiles table for active/non-active status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Allow finance roles to delete expenses
CREATE POLICY "Finance roles can delete expenses" 
ON public.expenses 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'accounting'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- Allow finance roles to delete income
CREATE POLICY "Finance roles can delete income" 
ON public.income 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

-- Allow HR to update profiles (for status changes)
CREATE POLICY "HR and super admin can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));