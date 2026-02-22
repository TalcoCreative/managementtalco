
-- Add publish_date, channel, and format columns to editorial_slides
ALTER TABLE public.editorial_slides 
  ADD COLUMN publish_date DATE DEFAULT NULL,
  ADD COLUMN channel TEXT DEFAULT 'instagram',
  ADD COLUMN format TEXT DEFAULT 'feed';
