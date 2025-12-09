-- Allow HR to manage user roles (insert, update, delete)
CREATE POLICY "HR can manage user roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'hr'::app_role))
WITH CHECK (has_role(auth.uid(), 'hr'::app_role));