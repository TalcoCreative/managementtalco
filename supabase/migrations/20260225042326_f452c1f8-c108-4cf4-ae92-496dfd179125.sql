
-- Forms table
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Form questions table
CREATE TABLE public.form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  is_required BOOLEAN DEFAULT false,
  field_order INTEGER DEFAULT 0,
  options JSONB,
  placeholder TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Form responses table
CREATE TABLE public.form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms(id) NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  respondent_name TEXT,
  respondent_email TEXT
);

-- Form answers table
CREATE TABLE public.form_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.form_responses(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.form_questions(id) NOT NULL,
  answer_text TEXT,
  answer_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_answers ENABLE ROW LEVEL SECURITY;

-- Forms policies (authenticated users can CRUD)
CREATE POLICY "Authenticated users can view forms" ON public.forms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create forms" ON public.forms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update forms" ON public.forms
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete forms" ON public.forms
  FOR DELETE TO authenticated USING (true);

-- Public can view active public forms (for public form page)
CREATE POLICY "Public can view active public forms" ON public.forms
  FOR SELECT TO anon USING (is_public = true AND status = 'active');

-- Form questions policies
CREATE POLICY "Authenticated users can manage questions" ON public.form_questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can view questions of public forms" ON public.form_questions
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.forms WHERE id = form_id AND is_public = true AND status = 'active')
  );

-- Form responses policies
CREATE POLICY "Authenticated users can view responses" ON public.form_responses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can submit responses to public forms" ON public.form_responses
  FOR INSERT TO anon WITH CHECK (
    EXISTS (SELECT 1 FROM public.forms WHERE id = form_id AND is_public = true AND status = 'active')
  );

CREATE POLICY "Authenticated users can submit responses" ON public.form_responses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete responses" ON public.form_responses
  FOR DELETE TO authenticated USING (true);

-- Form answers policies
CREATE POLICY "Authenticated users can view answers" ON public.form_answers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can submit answers to public forms" ON public.form_answers
  FOR INSERT TO anon WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_responses fr
      JOIN public.forms f ON f.id = fr.form_id
      WHERE fr.id = response_id AND f.is_public = true AND f.status = 'active'
    )
  );

CREATE POLICY "Authenticated users can submit answers" ON public.form_answers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete answers" ON public.form_answers
  FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER set_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for form uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('form-uploads', 'form-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for form uploads
CREATE POLICY "Anyone can upload form files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'form-uploads');

CREATE POLICY "Anyone can view form files" ON storage.objects
  FOR SELECT USING (bucket_id = 'form-uploads');
