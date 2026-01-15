-- Create positions table for dynamic position management
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  department TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - authenticated users can view all positions
CREATE POLICY "Authenticated users can view positions"
ON public.positions
FOR SELECT
TO authenticated
USING (true);

-- Only HR and SuperAdmin can manage positions
CREATE POLICY "HR and SuperAdmin can manage positions"
ON public.positions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'hr')
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_positions_updated_at
BEFORE UPDATE ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Insert default positions
INSERT INTO public.positions (name, department, color) VALUES
('Graphic Designer', 'Creative', '#8b5cf6'),
('Video Editor', 'Creative', '#ef4444'),
('Copywriter', 'Creative', '#22c55e'),
('Social Media Admin', 'Marketing', '#eab308'),
('Photographer', 'Creative', '#ec4899'),
('Director', 'Executive', '#6366f1'),
('Marketing', 'Marketing', '#f97316'),
('Sales', 'Sales', '#14b8a6'),
('Finance', 'Finance', '#10b981'),
('Accounting', 'Finance', '#06b6d4'),
('HR', 'Human Resources', '#3b82f6'),
('Project Manager', 'Operations', '#0d9488');