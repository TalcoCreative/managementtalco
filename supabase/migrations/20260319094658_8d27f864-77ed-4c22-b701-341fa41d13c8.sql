
-- Dummy accounts table
CREATE TABLE public.sm_dummy_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  platform text NOT NULL,
  account_name text,
  page_id text,
  ig_user_id text,
  access_token text,
  status text DEFAULT 'connected',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Dummy posts table
CREATE TABLE public.sm_dummy_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  account_id uuid REFERENCES public.sm_dummy_accounts(id) ON DELETE CASCADE,
  image_url text,
  caption text,
  scheduled_time timestamptz,
  status text DEFAULT 'draft',
  platform text DEFAULT 'instagram',
  created_at timestamptz DEFAULT now()
);

-- Dummy analytics table
CREATE TABLE public.sm_dummy_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.sm_dummy_accounts(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.sm_dummy_posts(id) ON DELETE CASCADE,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  engagement integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  date timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sm_dummy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_dummy_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_dummy_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can do everything
CREATE POLICY "Authenticated users can manage dummy accounts" ON public.sm_dummy_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage dummy posts" ON public.sm_dummy_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage dummy analytics" ON public.sm_dummy_analytics FOR ALL TO authenticated USING (true) WITH CHECK (true);
