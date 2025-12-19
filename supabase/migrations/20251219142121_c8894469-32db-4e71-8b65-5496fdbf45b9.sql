-- Create disciplinary_cases table
CREATE TABLE public.disciplinary_cases (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.profiles(id),
    reported_by UUID NOT NULL REFERENCES public.profiles(id),
    case_date DATE NOT NULL DEFAULT CURRENT_DATE,
    violation_type TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_url TEXT,
    severity TEXT NOT NULL DEFAULT 'minor',
    status TEXT NOT NULL DEFAULT 'pending',
    action_taken TEXT,
    action_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disciplinary_cases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "HR and super admin can view all disciplinary cases"
ON public.disciplinary_cases
FOR SELECT
USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR and super admin can create disciplinary cases"
ON public.disciplinary_cases
FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR and super admin can update disciplinary cases"
ON public.disciplinary_cases
FOR UPDATE
USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR and super admin can delete disciplinary cases"
ON public.disciplinary_cases
FOR DELETE
USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'hr'::app_role)
);

-- Create trigger for updated_at
CREATE TRIGGER update_disciplinary_cases_updated_at
    BEFORE UPDATE ON public.disciplinary_cases
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();