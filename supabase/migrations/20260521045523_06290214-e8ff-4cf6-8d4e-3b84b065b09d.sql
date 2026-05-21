
CREATE TABLE public.team_review_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  open_day INTEGER NOT NULL DEFAULT 25 CHECK (open_day BETWEEN 1 AND 31),
  deadline_day INTEGER NOT NULL DEFAULT 30 CHECK (deadline_day BETWEEN 1 AND 31),
  require_before_clockin BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE
);

INSERT INTO public.team_review_settings (enabled, open_day, deadline_day, require_before_clockin)
VALUES (false, 25, 30, false);

CREATE TABLE public.team_review_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.team_review_questions (question_text, order_index) VALUES
('This person takes initiative when problems arise', 1),
('This person accepts feedback and criticism professionally', 2),
('This person completes their tasks responsibly and on time', 3),
('I feel comfortable collaborating with this person', 4),
('This person communicates clearly and respectfully', 5);

CREATE TABLE public.team_review_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_month DATE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, review_month)
);
CREATE INDEX idx_trs_month ON public.team_review_submissions(review_month);

CREATE TABLE public.team_review_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.team_review_submissions(id) ON DELETE CASCADE,
  reviewed_user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.team_review_questions(id) ON DELETE CASCADE,
  review_month DATE NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tra_reviewed ON public.team_review_answers(reviewed_user_id, review_month);
CREATE INDEX idx_tra_question ON public.team_review_answers(question_id, review_month);

CREATE TABLE public.team_review_drafts (
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_month DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reviewer_id, review_month)
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS include_in_team_review BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.team_review_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_review_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_review_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_review_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_review_drafts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_hr_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::app_role)
      OR public.has_role(_user_id, 'hr'::app_role);
$$;

CREATE POLICY "trs_settings_read" ON public.team_review_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "trs_settings_write" ON public.team_review_settings
  FOR ALL TO authenticated USING (public.is_hr_or_admin(auth.uid()))
  WITH CHECK (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "trq_read" ON public.team_review_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "trq_write" ON public.team_review_questions
  FOR ALL TO authenticated USING (public.is_hr_or_admin(auth.uid()))
  WITH CHECK (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "trsub_insert_own" ON public.team_review_submissions
  FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "trsub_select_own_or_admin" ON public.team_review_submissions
  FOR SELECT TO authenticated USING (reviewer_id = auth.uid() OR public.is_hr_or_admin(auth.uid()));

CREATE POLICY "tra_insert_via_own_submission" ON public.team_review_answers
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_review_submissions s
      WHERE s.id = submission_id AND s.reviewer_id = auth.uid()
    )
  );
CREATE POLICY "tra_select_admin_only" ON public.team_review_answers
  FOR SELECT TO authenticated USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "trd_owner_all" ON public.team_review_drafts
  FOR ALL TO authenticated USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

CREATE TRIGGER set_trs_updated BEFORE UPDATE ON public.team_review_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_trq_updated BEFORE UPDATE ON public.team_review_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_trd_updated BEFORE UPDATE ON public.team_review_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
