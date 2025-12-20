-- Add DELETE policy for kol_campaigns
CREATE POLICY "Authorized roles can delete KOL campaigns"
ON public.kol_campaigns
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager') OR 
  has_role(auth.uid(), 'marketing') OR 
  has_role(auth.uid(), 'sales')
);

-- Add DELETE policy for kol_campaign_history
CREATE POLICY "Authorized roles can delete KOL campaign history"
ON public.kol_campaign_history
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager') OR 
  has_role(auth.uid(), 'marketing') OR 
  has_role(auth.uid(), 'sales')
);