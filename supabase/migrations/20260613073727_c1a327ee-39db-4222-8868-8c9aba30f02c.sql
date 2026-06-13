
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS text_color text DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS background_image text,
  ADD COLUMN IF NOT EXISTS button_label text DEFAULT 'OK',
  ADD COLUMN IF NOT EXISTS submit_label text DEFAULT 'Kirim',
  ADD COLUMN IF NOT EXISTS thank_you_title text DEFAULT 'Terima kasih!',
  ADD COLUMN IF NOT EXISTS thank_you_message text DEFAULT 'Respons Anda berhasil dikirim.',
  ADD COLUMN IF NOT EXISTS thank_you_image text,
  ADD COLUMN IF NOT EXISTS layout_size text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS show_progress boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS one_question_per_page boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'inter';

ALTER TABLE public.form_questions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_section_break boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS section_title text,
  ADD COLUMN IF NOT EXISTS section_description text;
