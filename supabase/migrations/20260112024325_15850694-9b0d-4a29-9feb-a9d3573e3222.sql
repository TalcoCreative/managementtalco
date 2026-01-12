-- Create table to store SocialBu connected accounts
CREATE TABLE IF NOT EXISTS public.socialbu_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  socialbu_account_id INTEGER NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  account_name TEXT,
  account_type TEXT,
  profile_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on socialbu_accounts
ALTER TABLE public.socialbu_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for socialbu_accounts
CREATE POLICY "Authenticated users can view socialbu accounts" 
ON public.socialbu_accounts 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Super admins and project managers can manage socialbu accounts" 
ON public.socialbu_accounts 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'project_manager')
  )
);

-- Add columns to social_media_posts for SocialBu tracking
ALTER TABLE public.social_media_posts 
ADD COLUMN IF NOT EXISTS socialbu_post_id INTEGER,
ADD COLUMN IF NOT EXISTS socialbu_account_id INTEGER,
ADD COLUMN IF NOT EXISTS publish_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_social_media_posts_socialbu_post_id 
ON public.social_media_posts(socialbu_post_id) WHERE socialbu_post_id IS NOT NULL;

-- Add more columns to analytics for detailed metrics
ALTER TABLE public.social_media_analytics
ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS video_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS post_clicks INTEGER DEFAULT 0;