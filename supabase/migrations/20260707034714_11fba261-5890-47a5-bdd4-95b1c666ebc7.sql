
DROP POLICY IF EXISTS "Authorized users can view candidates" ON public.candidates;
CREATE POLICY "Authorized users can view candidates" ON public.candidates
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_dynamic_perm(auth.uid(), 'recruitment'::text, 'can_view'::text)
  OR hr_pic_id = auth.uid()
);

DROP POLICY IF EXISTS "Authorized users can update candidates" ON public.candidates;
CREATE POLICY "Authorized users can update candidates" ON public.candidates
FOR UPDATE USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR has_dynamic_perm(auth.uid(), 'recruitment'::text, 'can_edit'::text)
  OR hr_pic_id = auth.uid()
);
