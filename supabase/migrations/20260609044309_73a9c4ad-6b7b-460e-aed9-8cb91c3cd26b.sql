
-- 1. published_contents master registry
CREATE TABLE public.published_contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  platform TEXT NOT NULL,
  content_type TEXT,
  content_url TEXT NOT NULL,
  content_external_id TEXT,
  thumbnail_url TEXT,
  caption_preview TEXT,
  caption_notes TEXT,
  publish_date DATE,
  ig_username TEXT,
  campaign_id UUID REFERENCES public.kol_campaigns(id) ON DELETE SET NULL,
  kol_id UUID REFERENCES public.kol_database(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  creator_user_id UUID,
  latest_views BIGINT,
  latest_likes BIGINT,
  latest_comments BIGINT,
  latest_shares BIGINT,
  latest_engagement_rate NUMERIC,
  performance_score TEXT,
  last_scraped_at TIMESTAMPTZ,
  scrape_status TEXT NOT NULL DEFAULT 'pending',
  scrape_error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.published_contents TO authenticated;
GRANT ALL ON public.published_contents TO service_role;

ALTER TABLE public.published_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view published_contents"
  ON public.published_contents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert published_contents"
  ON public.published_contents FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by OR auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update published_contents"
  ON public.published_contents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete published_contents"
  ON public.published_contents FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_published_contents_campaign ON public.published_contents(campaign_id);
CREATE INDEX idx_published_contents_platform ON public.published_contents(platform);
CREATE INDEX idx_published_contents_publish_date ON public.published_contents(publish_date);

CREATE TRIGGER trg_published_contents_updated_at
BEFORE UPDATE ON public.published_contents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. published_content_snapshots
CREATE TABLE public.published_content_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.published_contents(id) ON DELETE CASCADE,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  engagement BIGINT,
  engagement_rate NUMERIC,
  view_engagement_rate NUMERIC,
  comment_rate NUMERIC,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'firecrawl',
  raw_data JSONB
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.published_content_snapshots TO authenticated;
GRANT ALL ON public.published_content_snapshots TO service_role;

ALTER TABLE public.published_content_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view snapshots"
  ON public.published_content_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert snapshots"
  ON public.published_content_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_pcs_content ON public.published_content_snapshots(content_id, snapshot_at DESC);

-- 3. published_content_settings (singleton)
CREATE TABLE public.published_content_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  excellent_er NUMERIC NOT NULL DEFAULT 6.0,
  good_er NUMERIC NOT NULL DEFAULT 3.0,
  average_er NUMERIC NOT NULL DEFAULT 1.0,
  refresh_frequency_hours INTEGER NOT NULL DEFAULT 24,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.published_content_settings TO authenticated;
GRANT INSERT, UPDATE ON public.published_content_settings TO authenticated;
GRANT ALL ON public.published_content_settings TO service_role;

ALTER TABLE public.published_content_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view content settings"
  ON public.published_content_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR/Admin can update content settings"
  ON public.published_content_settings FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin(auth.uid()))
  WITH CHECK (public.is_hr_or_admin(auth.uid()));
CREATE POLICY "HR/Admin can insert content settings"
  ON public.published_content_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin(auth.uid()));

CREATE TRIGGER trg_pcs_settings_updated_at
BEFORE UPDATE ON public.published_content_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.published_content_settings (excellent_er, good_er, average_er, refresh_frequency_hours)
VALUES (6.0, 3.0, 1.0, 24);
