CREATE TABLE public.talents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  city TEXT,
  gender TEXT,
  birth_date DATE,
  instagram TEXT,
  portfolio_url TEXT,
  photo_url TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  shoe_size TEXT,
  shirt_size TEXT,
  pants_size TEXT,
  chest_cm NUMERIC,
  waist_cm NUMERIC,
  category TEXT,
  rate NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.talents TO authenticated;
GRANT ALL ON public.talents TO service_role;
ALTER TABLE public.talents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view talents" ON public.talents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert talents" ON public.talents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update talents" ON public.talents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete talents" ON public.talents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER set_talents_updated_at BEFORE UPDATE ON public.talents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_talents_status ON public.talents(status);
CREATE INDEX idx_talents_category ON public.talents(category);

CREATE TABLE public.shooting_talents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shooting_id UUID NOT NULL REFERENCES public.shooting_schedules(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.talents(id) ON DELETE CASCADE,
  role TEXT,
  fee NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shooting_id, talent_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shooting_talents TO authenticated;
GRANT ALL ON public.shooting_talents TO service_role;
ALTER TABLE public.shooting_talents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view shooting talents" ON public.shooting_talents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage shooting talents" ON public.shooting_talents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_shooting_talents_updated_at BEFORE UPDATE ON public.shooting_talents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.talent_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  title TEXT,
  show_rate BOOLEAN NOT NULL DEFAULT true,
  show_contact BOOLEAN NOT NULL DEFAULT false,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_share_links TO authenticated;
GRANT ALL ON public.talent_share_links TO service_role;
ALTER TABLE public.talent_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view talent share links" ON public.talent_share_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage talent share links" ON public.talent_share_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_talent_share_links_updated_at BEFORE UPDATE ON public.talent_share_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();