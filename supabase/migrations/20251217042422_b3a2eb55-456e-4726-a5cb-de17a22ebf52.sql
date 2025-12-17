-- Create meetings table
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'internal', -- internal, external
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  mode TEXT NOT NULL DEFAULT 'online', -- online, offline
  meeting_link TEXT,
  location TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, ongoing, completed, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting participants table (internal employees)
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

-- Create external participants table
CREATE TABLE public.meeting_external_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting notifications table
CREATE TABLE public.meeting_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_external_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notifications ENABLE ROW LEVEL SECURITY;

-- Meetings policies
CREATE POLICY "All authenticated users can view meetings" 
ON public.meetings FOR SELECT 
USING (true);

CREATE POLICY "All authenticated users can create meetings" 
ON public.meetings FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Meeting creator and HR can update meetings" 
ON public.meetings FOR UPDATE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

CREATE POLICY "Meeting creator and HR can delete meetings" 
ON public.meetings FOR DELETE 
USING (auth.uid() = created_by OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

-- Meeting participants policies
CREATE POLICY "All authenticated users can view participants" 
ON public.meeting_participants FOR SELECT 
USING (true);

CREATE POLICY "Meeting creator can manage participants" 
ON public.meeting_participants FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE id = meeting_id AND created_by = auth.uid()
));

CREATE POLICY "Users can update their own participation" 
ON public.meeting_participants FOR UPDATE 
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE id = meeting_id AND created_by = auth.uid()
));

CREATE POLICY "Meeting creator can delete participants" 
ON public.meeting_participants FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE id = meeting_id AND created_by = auth.uid()
));

-- External participants policies
CREATE POLICY "All authenticated users can view external participants" 
ON public.meeting_external_participants FOR SELECT 
USING (true);

CREATE POLICY "Meeting creator can manage external participants" 
ON public.meeting_external_participants FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE id = meeting_id AND created_by = auth.uid()
));

-- Notifications policies
CREATE POLICY "Users can view their own notifications" 
ON public.meeting_notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Meeting creator can create notifications" 
ON public.meeting_notifications FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meetings 
  WHERE id = meeting_id AND created_by = auth.uid()
));

CREATE POLICY "Users can update their own notifications" 
ON public.meeting_notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Add foreign key for created_by
ALTER TABLE public.meetings 
ADD CONSTRAINT fk_meetings_created_by 
FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- Create trigger for updated_at
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();