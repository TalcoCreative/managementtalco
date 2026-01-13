-- Add missing columns to social_media_settings for SocialBu integration
ALTER TABLE public.social_media_settings
ADD COLUMN IF NOT EXISTS auth_token TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.social_media_settings.auth_token IS 'SocialBu authentication token';
COMMENT ON COLUMN public.social_media_settings.user_email IS 'SocialBu user email';