-- Add default role to new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, user_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email
  );
  
  -- Assign default role (graphic_designer) to new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'graphic_designer');
  
  RETURN NEW;
END;
$$;

-- Update profiles RLS to allow all authenticated users to view each other
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

CREATE POLICY "All authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Allow all authenticated users to view user roles for collaboration
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "All authenticated users can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);