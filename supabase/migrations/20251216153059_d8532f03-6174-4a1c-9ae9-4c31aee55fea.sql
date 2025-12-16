
-- Create enum for recruitment status
CREATE TYPE public.recruitment_status AS ENUM (
  'applied',
  'screening_hr',
  'interview_user',
  'interview_final',
  'offering',
  'hired',
  'rejected'
);

-- Create candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  location TEXT,
  cv_url TEXT,
  portfolio_url TEXT,
  position TEXT NOT NULL,
  division TEXT NOT NULL,
  applied_at DATE NOT NULL DEFAULT CURRENT_DATE,
  status recruitment_status NOT NULL DEFAULT 'applied',
  hr_pic_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create candidate status history table
CREATE TABLE public.candidate_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  old_status recruitment_status NOT NULL,
  new_status recruitment_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create candidate assessments table
CREATE TABLE public.candidate_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL, -- 'hr' or 'user_interview'
  assessor_id UUID NOT NULL REFERENCES public.profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create candidate notes table
CREATE TABLE public.candidate_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for candidates
CREATE POLICY "HR and super admin can view candidates"
ON public.candidates FOR SELECT
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

CREATE POLICY "HR and super admin can create candidates"
ON public.candidates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

CREATE POLICY "HR and super admin can update candidates"
ON public.candidates FOR UPDATE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

CREATE POLICY "HR and super admin can delete candidates"
ON public.candidates FOR DELETE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

-- RLS Policies for candidate_status_history
CREATE POLICY "HR and super admin can view status history"
ON public.candidate_status_history FOR SELECT
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

CREATE POLICY "HR and super admin can create status history"
ON public.candidate_status_history FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

-- RLS Policies for candidate_assessments
CREATE POLICY "HR and super admin can view assessments"
ON public.candidate_assessments FOR SELECT
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

CREATE POLICY "HR and super admin can manage assessments"
ON public.candidate_assessments FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

-- RLS Policies for candidate_notes
CREATE POLICY "HR and super admin can view notes"
ON public.candidate_notes FOR SELECT
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

CREATE POLICY "HR and super admin can manage notes"
ON public.candidate_notes FOR ALL
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

-- Create trigger for updated_at
CREATE TRIGGER update_candidates_updated_at
BEFORE UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_candidate_assessments_updated_at
BEFORE UPDATE ON public.candidate_assessments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
