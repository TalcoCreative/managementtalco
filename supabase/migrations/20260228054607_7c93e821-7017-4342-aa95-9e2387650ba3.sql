
-- Add slug to editorial_slides for direct linking
ALTER TABLE public.editorial_slides ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add channels array for multi-platform support (keeps legacy channel column)
ALTER TABLE public.editorial_slides ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT '{}';

-- Add publish_links jsonb for storing published URLs per platform
ALTER TABLE public.editorial_slides ADD COLUMN IF NOT EXISTS publish_links JSONB DEFAULT '[]';

-- Generate initial slugs from slide_order for existing slides
UPDATE public.editorial_slides 
SET slug = 'slide-' || (slide_order + 1)
WHERE slug IS NULL;

-- Create unique constraint per EP
CREATE UNIQUE INDEX IF NOT EXISTS editorial_slides_ep_slug_unique ON public.editorial_slides(ep_id, slug);
