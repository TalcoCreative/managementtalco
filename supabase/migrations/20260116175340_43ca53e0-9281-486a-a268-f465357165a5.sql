
-- Create enum for slide status
CREATE TYPE public.ep_slide_status AS ENUM ('proposed', 'approved', 'published');

-- Create enum for content format
CREATE TYPE public.ep_content_format AS ENUM ('feed', 'carousel', 'reels', 'story');

-- Create enum for content channel
CREATE TYPE public.ep_content_channel AS ENUM ('instagram', 'tiktok', 'twitter', 'youtube', 'linkedin', 'other');

-- Create enum for block type
CREATE TYPE public.ep_block_type AS ENUM ('content_meta', 'image', 'video', 'status', 'internal_notes', 'external_notes');

-- Editorial Plans table
CREATE TABLE public.editorial_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  period TEXT, -- e.g. "2026-01", "ramadan-campaign"
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, slug)
);

-- Editorial Slides table
CREATE TABLE public.editorial_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ep_id UUID NOT NULL REFERENCES public.editorial_plans(id) ON DELETE CASCADE,
  slide_order INTEGER NOT NULL DEFAULT 0,
  status public.ep_slide_status NOT NULL DEFAULT 'proposed',
  approved_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Slide Blocks table
CREATE TABLE public.slide_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_id UUID NOT NULL REFERENCES public.editorial_slides(id) ON DELETE CASCADE,
  block_type public.ep_block_type NOT NULL,
  block_order INTEGER NOT NULL DEFAULT 0,
  content JSONB NOT NULL DEFAULT '{}',
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- EP Comments table (public, no login required)
CREATE TABLE public.ep_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ep_id UUID NOT NULL REFERENCES public.editorial_plans(id) ON DELETE CASCADE,
  slide_id UUID REFERENCES public.editorial_slides(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  comment TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- EP Activity Logs
CREATE TABLE public.ep_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ep_id UUID NOT NULL REFERENCES public.editorial_plans(id) ON DELETE CASCADE,
  slide_id UUID REFERENCES public.editorial_slides(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_name TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.editorial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slide_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for editorial_plans
CREATE POLICY "Authenticated users can view all editorial plans"
ON public.editorial_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create editorial plans"
ON public.editorial_plans FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update editorial plans"
ON public.editorial_plans FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete editorial plans"
ON public.editorial_plans FOR DELETE TO authenticated USING (true);

-- Public read access for EP (via slug)
CREATE POLICY "Public can view editorial plans"
ON public.editorial_plans FOR SELECT TO anon USING (true);

-- RLS Policies for editorial_slides
CREATE POLICY "Authenticated users can manage slides"
ON public.editorial_slides FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can view slides"
ON public.editorial_slides FOR SELECT TO anon USING (true);

-- RLS Policies for slide_blocks
CREATE POLICY "Authenticated users can manage blocks"
ON public.slide_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can view non-internal blocks"
ON public.slide_blocks FOR SELECT TO anon USING (is_internal = false);

-- RLS Policies for ep_comments
CREATE POLICY "Anyone can view non-hidden comments"
ON public.ep_comments FOR SELECT USING (is_hidden = false);

CREATE POLICY "Anyone can create comments"
ON public.ep_comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update comments"
ON public.ep_comments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete comments"
ON public.ep_comments FOR DELETE TO authenticated USING (true);

-- RLS Policies for ep_activity_logs
CREATE POLICY "Authenticated users can view activity logs"
ON public.ep_activity_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can create activity logs"
ON public.ep_activity_logs FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_editorial_plans_client ON public.editorial_plans(client_id);
CREATE INDEX idx_editorial_plans_slug ON public.editorial_plans(slug);
CREATE INDEX idx_editorial_slides_ep ON public.editorial_slides(ep_id);
CREATE INDEX idx_editorial_slides_order ON public.editorial_slides(ep_id, slide_order);
CREATE INDEX idx_slide_blocks_slide ON public.slide_blocks(slide_id);
CREATE INDEX idx_slide_blocks_order ON public.slide_blocks(slide_id, block_order);
CREATE INDEX idx_ep_comments_ep ON public.ep_comments(ep_id);

-- Triggers for updated_at
CREATE TRIGGER update_editorial_plans_updated_at
  BEFORE UPDATE ON public.editorial_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_editorial_slides_updated_at
  BEFORE UPDATE ON public.editorial_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_slide_blocks_updated_at
  BEFORE UPDATE ON public.slide_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for EP assets
INSERT INTO storage.buckets (id, name, public) VALUES ('ep-assets', 'ep-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view EP assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'ep-assets');

CREATE POLICY "Authenticated users can upload EP assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ep-assets');

CREATE POLICY "Authenticated users can update EP assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ep-assets');

CREATE POLICY "Authenticated users can delete EP assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ep-assets');
