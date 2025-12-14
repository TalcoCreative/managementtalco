-- Create prospects table
CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  email text,
  phone text,
  company text,
  location text,
  needs text,
  product_service text,
  source text NOT NULL,
  pic_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id)
);

-- Create prospect comments table
CREATE TABLE IF NOT EXISTS public.prospect_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create prospect status history table
CREATE TABLE IF NOT EXISTS public.prospect_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  old_status text NOT NULL,
  new_status text NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_status_history ENABLE ROW LEVEL SECURITY;

-- Prospects policies
CREATE POLICY "Prospects - view for sales & hr & marketing" ON public.prospects
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'hr') OR
  has_role(auth.uid(), 'sales') OR
  has_role(auth.uid(), 'marketing')
);

CREATE POLICY "Prospects - insert by sales & hr & marketing" ON public.prospects
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'hr') OR
  has_role(auth.uid(), 'sales') OR
  has_role(auth.uid(), 'marketing')
);

CREATE POLICY "Prospects - update by owner & hr & super_admin" ON public.prospects
FOR UPDATE
USING (
  created_by = auth.uid() OR
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'hr')
);

CREATE POLICY "Prospects - delete by super_admin & hr" ON public.prospects
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'hr')
);

-- Prospect comments policies
CREATE POLICY "Prospect comments - view" ON public.prospect_comments
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'hr') OR
  has_role(auth.uid(), 'sales') OR
  has_role(auth.uid(), 'marketing')
);

CREATE POLICY "Prospect comments - insert" ON public.prospect_comments
FOR INSERT
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Prospect comments - delete own" ON public.prospect_comments
FOR DELETE
USING (
  auth.uid() = author_id OR
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'hr')
);

-- Prospect status history policies
CREATE POLICY "Prospect history - view" ON public.prospect_status_history
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'hr') OR
  has_role(auth.uid(), 'sales') OR
  has_role(auth.uid(), 'marketing')
);

CREATE POLICY "Prospect history - insert" ON public.prospect_status_history
FOR INSERT
WITH CHECK (auth.uid() = changed_by);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_prospects_updated_at ON public.prospects;
CREATE TRIGGER set_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();