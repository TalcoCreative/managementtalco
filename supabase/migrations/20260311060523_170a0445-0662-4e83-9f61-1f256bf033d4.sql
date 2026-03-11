
-- Drop broken triggers that prevent notifications from being saved
DROP TRIGGER IF EXISTS push_on_task_notification ON public.task_notifications;
DROP TRIGGER IF EXISTS push_on_mention ON public.comment_mentions;
DROP TRIGGER IF EXISTS push_on_candidate_notification ON public.candidate_notifications;

-- Create push notification logs table for admin monitoring
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_ids text[] NOT NULL DEFAULT '{}',
  title text NOT NULL,
  body text,
  url text,
  tag text,
  status text NOT NULL DEFAULT 'pending',
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  total_subscriptions integer DEFAULT 0,
  error_details text,
  triggered_by text
);

ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view push logs" ON public.push_notification_logs
  FOR SELECT TO authenticated
  USING (
    public.has_dynamic_perm(auth.uid(), 'system_settings', 'can_view')
  );

CREATE POLICY "Edge functions can insert push logs" ON public.push_notification_logs
  FOR INSERT
  WITH CHECK (true);
