-- Create a security definer function that checks dynamic role permissions
-- This bridges the gap between dynamic_roles/role_permissions and RLS policies
CREATE OR REPLACE FUNCTION public.has_dynamic_perm(_user_id uuid, _feature_key text, _action text DEFAULT 'can_view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_dynamic_roles udr
    JOIN public.role_permissions rp ON rp.role_id = udr.role_id
    WHERE udr.user_id = _user_id
      AND rp.feature_key = _feature_key
      AND (
        (_action = 'can_view' AND rp.can_view = true) OR
        (_action = 'can_create' AND rp.can_create = true) OR
        (_action = 'can_edit' AND rp.can_edit = true) OR
        (_action = 'can_delete' AND rp.can_delete = true) OR
        (_action = 'can_export' AND rp.can_export = true)
      )
  )
$$;