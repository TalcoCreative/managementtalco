ALTER TABLE public.kol_database
ADD COLUMN IF NOT EXISTS rate_cards JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.kol_database
SET rate_cards = COALESCE(
  (
    SELECT jsonb_agg(entry)
    FROM (
      SELECT jsonb_build_object('platform','instagram','content_type','story','label','IG Story','rate', rate_ig_story) AS entry WHERE rate_ig_story IS NOT NULL
      UNION ALL
      SELECT jsonb_build_object('platform','instagram','content_type','feed','label','IG Feed','rate', rate_ig_feed) WHERE rate_ig_feed IS NOT NULL
      UNION ALL
      SELECT jsonb_build_object('platform','instagram','content_type','reels','label','IG Reels','rate', rate_ig_reels) WHERE rate_ig_reels IS NOT NULL
      UNION ALL
      SELECT jsonb_build_object('platform','tiktok','content_type','video','label','TikTok Video','rate', rate_tiktok_video) WHERE rate_tiktok_video IS NOT NULL
      UNION ALL
      SELECT jsonb_build_object('platform','youtube','content_type','video','label','YouTube Video','rate', rate_youtube_video) WHERE rate_youtube_video IS NOT NULL
    ) AS s
  ),
  '[]'::jsonb
)
WHERE jsonb_array_length(rate_cards) = 0;