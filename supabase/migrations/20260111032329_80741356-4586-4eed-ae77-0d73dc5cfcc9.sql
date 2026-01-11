-- Add external_id and live_post_url columns if not exist
ALTER TABLE public.social_media_posts 
ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS live_post_url TEXT,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;

-- Create social media settings table for SocialBu API
CREATE TABLE IF NOT EXISTS public.social_media_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_secret_encrypted TEXT,
  is_connected BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS for settings
ALTER TABLE public.social_media_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_media_settings (admin only)
CREATE POLICY "Super admins can manage social media settings"
ON public.social_media_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'project_manager')
  )
);

-- Add social_media_slug to clients for shareable links
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS social_media_slug TEXT UNIQUE;