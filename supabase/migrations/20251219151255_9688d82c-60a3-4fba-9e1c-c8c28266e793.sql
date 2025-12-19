-- Create letters table
CREATE TABLE public.letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_number TEXT NOT NULL UNIQUE,
  entity_code TEXT NOT NULL CHECK (entity_code IN ('TCI', 'TS', 'TW')),
  entity_name TEXT NOT NULL,
  category_code TEXT NOT NULL CHECK (category_code IN ('HR', 'FIN', 'ADM', 'MKT', 'PRJ', 'GEN')),
  category_name TEXT NOT NULL,
  project_label TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_company TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready_to_send', 'sent', 'closed')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  document_url TEXT,
  notes TEXT,
  running_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create letter activity logs table
CREATE TABLE public.letter_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_id UUID NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for letters
CREATE POLICY "Authenticated users can view letters"
  ON public.letters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR, Super Admin, Finance, PM can create letters"
  ON public.letters FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'finance') OR
    public.has_role(auth.uid(), 'project_manager')
  );

CREATE POLICY "HR, Super Admin, Finance, PM can update letters"
  ON public.letters FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'finance') OR
    public.has_role(auth.uid(), 'project_manager')
  );

CREATE POLICY "HR, Super Admin can delete letters"
  ON public.letters FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'hr') OR
    public.has_role(auth.uid(), 'super_admin')
  );

-- RLS Policies for letter activity logs
CREATE POLICY "Authenticated users can view letter logs"
  ON public.letter_activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create letter logs"
  ON public.letter_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to get next running number for letters
CREATE OR REPLACE FUNCTION public.get_next_letter_number(
  p_entity_code TEXT,
  p_category_code TEXT,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(running_number), 0) + 1
  INTO next_number
  FROM public.letters
  WHERE entity_code = p_entity_code
    AND category_code = p_category_code
    AND year = p_year;
  
  RETURN next_number;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER set_letters_updated_at
  BEFORE UPDATE ON public.letters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_letters_entity ON public.letters(entity_code);
CREATE INDEX idx_letters_category ON public.letters(category_code);
CREATE INDEX idx_letters_status ON public.letters(status);
CREATE INDEX idx_letters_year ON public.letters(year);
CREATE INDEX idx_letters_created_by ON public.letters(created_by);
CREATE INDEX idx_letter_logs_letter ON public.letter_activity_logs(letter_id);