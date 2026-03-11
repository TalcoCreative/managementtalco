-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Function to send push notification when task_notifications are inserted
CREATE OR REPLACE FUNCTION public.trigger_push_on_task_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get config
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  
  -- Send push via edge function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', 'Talco Management System',
      'body', COALESCE(NEW.message, 'You have a new notification'),
      'url', CASE 
        WHEN NEW.task_id IS NOT NULL THEN '/tasks'
        WHEN NEW.shooting_id IS NOT NULL THEN '/shooting'
        WHEN NEW.meeting_id IS NOT NULL THEN '/meeting'
        ELSE '/'
      END,
      'tag', 'notif-' || NEW.id
    )
  ) INTO request_id;
  
  RETURN NEW;
END;
$$;

-- Function to send push when comment mentions are inserted
CREATE OR REPLACE FUNCTION public.trigger_push_on_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  request_id BIGINT;
  mentioner_name TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  
  -- Get mentioner name from the comment
  SELECT p.full_name INTO mentioner_name
  FROM comments c JOIN profiles p ON p.id = c.author_id
  WHERE c.id = NEW.comment_id
  LIMIT 1;
  
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.mentioned_user_id,
      'title', 'Talco - You were mentioned',
      'body', COALESCE(mentioner_name, 'Someone') || ' mentioned you in a comment',
      'url', '/tasks',
      'tag', 'mention-' || NEW.id
    )
  ) INTO request_id;
  
  RETURN NEW;
END;
$$;

-- Function to send push when candidate notifications are inserted
CREATE OR REPLACE FUNCTION public.trigger_push_on_candidate_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', 'Talco - New Candidate',
      'body', COALESCE(NEW.message, 'A new candidate has applied'),
      'url', '/recruitment',
      'tag', 'candidate-' || NEW.id
    )
  ) INTO request_id;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER push_on_task_notification
  AFTER INSERT ON public.task_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_task_notification();

CREATE TRIGGER push_on_mention
  AFTER INSERT ON public.comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_mention();

CREATE TRIGGER push_on_candidate_notification
  AFTER INSERT ON public.candidate_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_candidate_notification();