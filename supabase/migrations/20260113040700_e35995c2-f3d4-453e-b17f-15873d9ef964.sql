-- Add per-user scoping for SocialBu settings
ALTER TABLE public.social_media_settings
ADD COLUMN IF NOT EXISTS user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_media_settings_user_id_fkey'
  ) THEN
    ALTER TABLE public.social_media_settings
    ADD CONSTRAINT social_media_settings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS social_media_settings_user_id_key
ON public.social_media_settings(user_id);

COMMENT ON COLUMN public.social_media_settings.user_id IS 'Owner of this SocialBu connection (authenticated user id)';
