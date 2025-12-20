-- Create KOL Database table
CREATE TABLE public.kol_database (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  link_account TEXT,
  -- Social accounts
  instagram_url TEXT,
  tiktok_url TEXT,
  twitter_url TEXT,
  linkedin_url TEXT,
  youtube_url TEXT,
  threads_url TEXT,
  -- Followers count
  ig_followers INTEGER,
  tiktok_followers INTEGER,
  twitter_followers INTEGER,
  linkedin_followers INTEGER,
  youtube_followers INTEGER,
  threads_followers INTEGER,
  -- Category (nano/micro/macro/mega) - computed based on max followers
  category TEXT NOT NULL DEFAULT 'nano',
  -- Ratecard
  rate_ig_story NUMERIC,
  rate_ig_feed NUMERIC,
  rate_ig_reels NUMERIC,
  rate_tiktok_video NUMERIC,
  rate_youtube_video NUMERIC,
  -- Industry / niche
  industry TEXT,
  notes TEXT,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL
);

-- Create KOL Campaigns table
CREATE TABLE public.kol_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kol_id UUID NOT NULL REFERENCES public.kol_database(id),
  client_id UUID REFERENCES public.clients(id),
  project_id UUID REFERENCES public.projects(id),
  campaign_name TEXT NOT NULL,
  platform TEXT NOT NULL, -- ig_story, ig_feed, ig_reels, tiktok, youtube
  is_visit BOOLEAN NOT NULL DEFAULT false,
  visit_location TEXT,
  status TEXT NOT NULL DEFAULT 'contacted', -- contacted, negotiation, deal, production, visit, ready_to_post, posted, completed
  -- Payment
  fee NUMERIC,
  bank_account_number TEXT,
  bank_account_name TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES public.profiles(id),
  -- Posting status
  is_posted BOOLEAN NOT NULL DEFAULT false,
  post_link TEXT,
  evidence_url TEXT,
  -- PIC
  pic_id UUID REFERENCES public.profiles(id),
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL
);

-- Create KOL Campaign History table for activity log
CREATE TABLE public.kol_campaign_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.kol_campaigns(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- contacted, replied, deal, production, visit, ready_to_post, posted, payment, status_change, etc.
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.kol_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kol_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kol_campaign_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kol_database
CREATE POLICY "Authorized roles can view KOL database"
ON public.kol_database
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'marketing'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role)
);

CREATE POLICY "Authorized roles can create KOL"
ON public.kol_database
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'marketing'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role)
);

CREATE POLICY "Authorized roles can update KOL"
ON public.kol_database
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'marketing'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role)
);

-- RLS Policies for kol_campaigns
CREATE POLICY "Authorized roles can view KOL campaigns"
ON public.kol_campaigns
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'marketing'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role)
);

CREATE POLICY "Authorized roles can create KOL campaigns"
ON public.kol_campaigns
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'marketing'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role)
);

CREATE POLICY "Authorized roles can update KOL campaigns"
ON public.kol_campaigns
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'marketing'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role)
);

-- RLS Policies for kol_campaign_history
CREATE POLICY "Authorized roles can view KOL campaign history"
ON public.kol_campaign_history
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'marketing'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role)
);

CREATE POLICY "Authorized roles can create KOL campaign history"
ON public.kol_campaign_history
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  has_role(auth.uid(), 'marketing'::app_role) OR
  has_role(auth.uid(), 'sales'::app_role)
);

-- Function to auto-calculate KOL category based on followers
CREATE OR REPLACE FUNCTION public.calculate_kol_category()
RETURNS TRIGGER AS $$
DECLARE
  max_followers INTEGER;
BEGIN
  -- Get the maximum followers count across all platforms
  max_followers := GREATEST(
    COALESCE(NEW.ig_followers, 0),
    COALESCE(NEW.tiktok_followers, 0),
    COALESCE(NEW.twitter_followers, 0),
    COALESCE(NEW.linkedin_followers, 0),
    COALESCE(NEW.youtube_followers, 0),
    COALESCE(NEW.threads_followers, 0)
  );
  
  -- Categorize based on followers
  IF max_followers >= 1000000 THEN
    NEW.category := 'mega';
  ELSIF max_followers >= 100000 THEN
    NEW.category := 'macro';
  ELSIF max_followers >= 10000 THEN
    NEW.category := 'micro';
  ELSE
    NEW.category := 'nano';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-calculate category on insert/update
CREATE TRIGGER calculate_kol_category_trigger
BEFORE INSERT OR UPDATE ON public.kol_database
FOR EACH ROW
EXECUTE FUNCTION public.calculate_kol_category();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_kol_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_kol_database_updated_at
BEFORE UPDATE ON public.kol_database
FOR EACH ROW
EXECUTE FUNCTION public.update_kol_updated_at();

CREATE TRIGGER update_kol_campaigns_updated_at
BEFORE UPDATE ON public.kol_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_kol_updated_at();