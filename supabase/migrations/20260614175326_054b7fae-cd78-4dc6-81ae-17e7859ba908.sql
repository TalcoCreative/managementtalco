
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS thank_you_redirect_url text,
  ADD COLUMN IF NOT EXISTS thank_you_redirect_delay integer DEFAULT 3;

ALTER TABLE public.form_questions
  ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS logic_rules jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.form_questions.config IS 'Per-type settings: min, max, step, accept, scale_min, scale_max, scale_left_label, scale_right_label, heading_level, image_url, embed_url, formula, currency, etc.';
COMMENT ON COLUMN public.form_questions.logic_rules IS 'Array of conditional rules: [{field_id, operator, value, action: show|hide|jump, target_question_id}]';
