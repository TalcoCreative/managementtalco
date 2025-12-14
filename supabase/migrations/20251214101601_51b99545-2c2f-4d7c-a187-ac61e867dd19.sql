-- Allow finance/HR roles to delete payroll
CREATE POLICY "Finance roles can delete payroll" 
ON public.payroll 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'hr'::app_role));