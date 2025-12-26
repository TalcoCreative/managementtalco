-- Create table for connected social media accounts
CREATE TABLE public.social_media_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok')),
  account_name TEXT,
  account_id TEXT,
  page_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, account_id)
);

-- Create table for social media posts
CREATE TABLE public.social_media_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok')),
  content_type TEXT NOT NULL CHECK (content_type IN ('reels', 'carousel', 'feed', 'story', 'tiktok_video')),
  media_urls TEXT[] DEFAULT '{}',
  caption TEXT,
  hashtags TEXT,
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posting', 'posted', 'failed')),
  error_message TEXT,
  post_id TEXT,
  post_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for social media analytics
CREATE TABLE public.social_media_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_media_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_media_accounts
CREATE POLICY "Users can view all connected accounts"
ON public.social_media_accounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage their own accounts"
ON public.social_media_accounts FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for social_media_posts
CREATE POLICY "Authenticated users can view all posts"
ON public.social_media_posts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create posts"
ON public.social_media_posts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Staff can update their own posts"
ON public.social_media_posts FOR UPDATE
TO authenticated
USING (staff_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Staff can delete their own posts"
ON public.social_media_posts FOR DELETE
TO authenticated
USING (staff_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role));

-- RLS Policies for social_media_analytics
CREATE POLICY "Authenticated users can view analytics"
ON public.social_media_analytics FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage analytics"
ON public.social_media_analytics FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create updated_at triggers
CREATE TRIGGER update_social_media_accounts_updated_at
  BEFORE UPDATE ON public.social_media_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_social_media_posts_updated_at
  BEFORE UPDATE ON public.social_media_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create indexes for better query performance
CREATE INDEX idx_social_media_posts_client ON public.social_media_posts(client_id);
CREATE INDEX idx_social_media_posts_staff ON public.social_media_posts(staff_id);
CREATE INDEX idx_social_media_posts_status ON public.social_media_posts(status);
CREATE INDEX idx_social_media_posts_scheduled ON public.social_media_posts(scheduled_at);
CREATE INDEX idx_social_media_analytics_post ON public.social_media_analytics(post_id);