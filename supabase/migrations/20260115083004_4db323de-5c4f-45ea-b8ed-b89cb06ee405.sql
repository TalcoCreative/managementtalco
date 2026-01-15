-- Recruitment Form Builder Tables

-- 1. recruitment_forms - stores form definitions
CREATE TABLE public.recruitment_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. recruitment_form_fields - stores custom fields for each form
CREATE TABLE public.recruitment_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.recruitment_forms(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN ('short_text', 'long_text', 'email', 'phone', 'file', 'url', 'multiple_choice', 'dropdown', 'rating', 'yes_no')),
  label TEXT NOT NULL,
  placeholder TEXT,
  helper_text TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  options JSONB,
  field_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. recruitment_form_submissions - stores submitted form data
CREATE TABLE public.recruitment_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.recruitment_forms(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  submission_data JSONB NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add source_form_id to candidates table
ALTER TABLE public.candidates 
ADD COLUMN source_form_id UUID REFERENCES public.recruitment_forms(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.recruitment_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recruitment_forms
CREATE POLICY "HR and SuperAdmin can manage recruitment forms"
ON public.recruitment_forms
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'hr')
  )
);

CREATE POLICY "Public can view active recruitment forms"
ON public.recruitment_forms
FOR SELECT
USING (status = 'active');

-- RLS Policies for recruitment_form_fields
CREATE POLICY "HR and SuperAdmin can manage form fields"
ON public.recruitment_form_fields
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'hr')
  )
);

CREATE POLICY "Public can view fields of active forms"
ON public.recruitment_form_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.recruitment_forms
    WHERE id = form_id AND status = 'active'
  )
);

-- RLS Policies for recruitment_form_submissions
CREATE POLICY "HR and SuperAdmin can view all submissions"
ON public.recruitment_form_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'hr')
  )
);

CREATE POLICY "Anyone can submit forms"
ON public.recruitment_form_submissions
FOR INSERT
WITH CHECK (true);

-- Create updated_at trigger using existing function
CREATE TRIGGER update_recruitment_forms_updated_at
BEFORE UPDATE ON public.recruitment_forms
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();