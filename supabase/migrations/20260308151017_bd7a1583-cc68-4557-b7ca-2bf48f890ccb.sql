
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text UNIQUE NOT NULL,
  label text NOT NULL,
  subject_template text NOT NULL,
  main_message text NOT NULL DEFAULT '',
  footer_message text NOT NULL DEFAULT 'Kalau ini penting, jangan di-skip ya 😎',
  button_text text NOT NULL DEFAULT '🔗 Cek detailnya di sini',
  body_html text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email templates"
ON public.email_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update email templates"
ON public.email_templates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert email templates"
ON public.email_templates FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.email_templates (notification_type, label, subject_template, main_message) VALUES
('task_assignment', 'Task Assignment', 'Hi @{{firstName}} – ada Task baru buat lo nih 👀', 'Ada task baru yang di-assign ke lo:'),
('task_updated', 'Task Updated', 'Hi @{{firstName}} – Task lo ada update nih 📝', 'Ada update baru di task lo:'),
('task_completed', 'Task Completed', 'Hi @{{firstName}} – Task selesai nih ✅', 'Ada update status task:'),
('task_status_change', 'Task Status Change', 'Hi @{{firstName}} – status task berubah nih 🔄', 'Ada update status task:'),
('task_overdue', 'Task Overdue', 'Hi @{{firstName}} – Task lo udah lewat nih 😬', 'Ada task yang udah lewat deadline:'),
('task_mention', 'Task Mention', 'Hi @{{firstName}} – lo di-mention di task nih 👀', 'Lo baru aja di-mention di sebuah task:'),
('project_assignment', 'Project Assignment', 'Hi @{{firstName}} – lo join project baru nih 🚀', 'Lo baru aja di-assign ke project baru:'),
('shooting_assignment', 'Shooting Assignment', 'Hi @{{firstName}} – lo dijadwalkan shooting nih 🎥', 'Lo dijadwalkan untuk shooting:'),
('shooting_status_update', 'Shooting Status Update', 'Hi @{{firstName}} – ada update shooting nih 🎬', 'Ada update status shooting:'),
('event_assignment', 'Event Assignment', 'Hi @{{firstName}} – lo dijadwalkan event nih 🎥', 'Lo dijadwalkan untuk event:'),
('meeting_invitation', 'Meeting Invitation', 'Hi @{{firstName}} – lo diundang meeting nih 📅', 'Lo diundang ke meeting:'),
('meeting_reminder', 'Meeting Reminder', 'Hi @{{firstName}} – reminder meeting nih 📅', 'Reminder: meeting segera dimulai:'),
('announcement', 'Announcement', '📢 Pengumuman: Ada info penting nih buat lo!', 'Ada pengumuman penting:'),
('recruitment_pic_assigned', 'Recruitment PIC', 'Hi @{{firstName}} – lo ditunjuk jadi PIC kandidat nih 📋', 'Lo ditunjuk sebagai PIC untuk kandidat baru:');
