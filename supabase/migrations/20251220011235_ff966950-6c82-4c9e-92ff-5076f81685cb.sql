
-- Events table (master event data)
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  project_id UUID REFERENCES public.projects(id),
  event_type TEXT NOT NULL,
  location TEXT,
  is_online BOOLEAN DEFAULT false,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  pic_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'planning',
  current_phase TEXT NOT NULL DEFAULT 'pre_event',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- Event crew (internal + freelancer)
CREATE TABLE public.event_crew (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  crew_type TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  freelancer_name TEXT,
  freelancer_contact TEXT,
  freelancer_company TEXT,
  freelancer_location TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  fee NUMERIC,
  is_paid BOOLEAN DEFAULT false,
  bank_account TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event vendors
CREATE TABLE public.event_vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'contacted',
  cost NUMERIC,
  is_paid BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event checklists (execution day)
CREATE TABLE public.event_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event issues (problem log)
CREATE TABLE public.event_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  reported_by UUID NOT NULL REFERENCES public.profiles(id),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event documents (post-event)
CREATE TABLE public.event_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_url TEXT,
  document_type TEXT,
  notes TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event history (change tracking)
CREATE TABLE public.event_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Freelancer database (for reuse)
CREATE TABLE public.freelancers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  company TEXT,
  location TEXT,
  specialization TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- Add event_id to tasks table to link tasks to events
ALTER TABLE public.tasks ADD COLUMN event_id UUID REFERENCES public.events(id);

-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "Authorized roles can view events"
ON public.events FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager') OR 
  has_role(auth.uid(), 'marketing') OR
  has_role(auth.uid(), 'sales') OR
  pic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()::text LIMIT 1)
);

CREATE POLICY "Authorized roles can create events"
ON public.events FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

CREATE POLICY "Authorized roles can update events"
ON public.events FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

CREATE POLICY "Authorized roles can delete events"
ON public.events FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

-- RLS Policies for event_crew
CREATE POLICY "Users can view event crew" ON public.event_crew FOR SELECT USING (true);
CREATE POLICY "Authorized roles can insert event crew"
ON public.event_crew FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can update event crew"
ON public.event_crew FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can delete event crew"
ON public.event_crew FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

-- RLS Policies for event_vendors
CREATE POLICY "Users can view event vendors" ON public.event_vendors FOR SELECT USING (true);
CREATE POLICY "Authorized roles can insert event vendors"
ON public.event_vendors FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can update event vendors"
ON public.event_vendors FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can delete event vendors"
ON public.event_vendors FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

-- RLS Policies for event_checklists
CREATE POLICY "Users can view event checklists" ON public.event_checklists FOR SELECT USING (true);
CREATE POLICY "Authorized roles can insert event checklists"
ON public.event_checklists FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can update event checklists"
ON public.event_checklists FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can delete event checklists"
ON public.event_checklists FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

-- RLS Policies for event_issues
CREATE POLICY "Users can view event issues" ON public.event_issues FOR SELECT USING (true);
CREATE POLICY "Authorized roles can insert event issues"
ON public.event_issues FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can update event issues"
ON public.event_issues FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can delete event issues"
ON public.event_issues FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

-- RLS Policies for event_documents
CREATE POLICY "Users can view event documents" ON public.event_documents FOR SELECT USING (true);
CREATE POLICY "Authorized roles can insert event documents"
ON public.event_documents FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can update event documents"
ON public.event_documents FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can delete event documents"
ON public.event_documents FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

-- RLS Policies for event_history
CREATE POLICY "Users can view event history" ON public.event_history FOR SELECT USING (true);
CREATE POLICY "Authorized roles can insert event history"
ON public.event_history FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

-- RLS Policies for freelancers
CREATE POLICY "Users can view freelancers" ON public.freelancers FOR SELECT USING (true);
CREATE POLICY "Authorized roles can insert freelancers"
ON public.freelancers FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can update freelancers"
ON public.freelancers FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Authorized roles can delete freelancers"
ON public.freelancers FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'hr') OR 
  has_role(auth.uid(), 'project_manager')
);

-- Trigger for updated_at on events
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
