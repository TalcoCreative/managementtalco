
-- Table to store cached WhatsApp groups from Fonnte
CREATE TABLE public.wa_groups (
  id TEXT PRIMARY KEY, -- Fonnte group ID (xxx@g.us)
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wa_groups"
  ON public.wa_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage wa_groups"
  ON public.wa_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table to store notification type settings with group assignments
CREATE TABLE public.wa_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  send_to_personal BOOLEAN NOT NULL DEFAULT true,
  group_ids TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.wa_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wa_notification_settings"
  ON public.wa_notification_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage wa_notification_settings"
  ON public.wa_notification_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default notification types
INSERT INTO public.wa_notification_settings (event_type, label) VALUES
  ('task_assigned', 'Task Assigned'),
  ('task_status_updated', 'Task Status Changed'),
  ('task_comment', 'Task Comment'),
  ('task_mention', 'Task Mention'),
  ('task_deadline', 'Task Deadline Reminder'),
  ('meeting_created', 'Meeting Created'),
  ('meeting_reminder', 'Meeting Reminder'),
  ('shooting_created', 'Shooting Created'),
  ('shooting_reminder', 'Shooting Reminder'),
  ('attendance_reminder', 'Attendance Reminder'),
  ('announcement', 'Announcement'),
  ('recruitment_new', 'New Candidate Applied'),
  ('project_created', 'Project Created'),
  ('leave_request', 'Leave Request'),
  ('event_created', 'Event Created');
