
-- Dynamic Roles table
CREATE TABLE public.dynamic_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dynamic_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read dynamic_roles" ON public.dynamic_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage dynamic_roles" ON public.dynamic_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Role Permissions table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.dynamic_roles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  can_comment BOOLEAN NOT NULL DEFAULT false,
  can_mention BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, feature_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage role_permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- User Dynamic Roles mapping
CREATE TABLE public.user_dynamic_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.dynamic_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

ALTER TABLE public.user_dynamic_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read user_dynamic_roles" ON public.user_dynamic_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage user_dynamic_roles" ON public.user_dynamic_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at on dynamic_roles
CREATE TRIGGER set_dynamic_roles_updated_at
  BEFORE UPDATE ON public.dynamic_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
