-- Allow finance roles to delete recurring budget
CREATE POLICY "Finance roles can delete recurring budget" 
ON public.recurring_budget 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

-- Allow approvers to delete reimbursements
CREATE POLICY "Approvers can delete reimbursements" 
ON public.reimbursements 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'hr'::app_role));