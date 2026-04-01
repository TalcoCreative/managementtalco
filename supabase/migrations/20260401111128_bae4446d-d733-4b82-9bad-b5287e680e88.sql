
-- Add new columns to social_media_accounts for real Meta API data
ALTER TABLE public.social_media_accounts 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS page_id TEXT,
  ADD COLUMN IF NOT EXISTS ig_user_id TEXT,
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'connected',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS followers_count INTEGER,
  ADD COLUMN IF NOT EXISTS media_count INTEGER;
