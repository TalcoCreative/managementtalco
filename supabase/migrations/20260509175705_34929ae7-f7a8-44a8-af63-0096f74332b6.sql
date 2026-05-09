
-- Meeting notifications -> push
CREATE OR REPLACE FUNCTION public.trigger_push_on_meeting_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  supabase_url TEXT; service_key TEXT; req_id BIGINT;
  m_title TEXT; m_date TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;

  SELECT title, to_char(meeting_date, 'DD Mon YYYY HH24:MI') INTO m_title, m_date
  FROM meetings WHERE id = NEW.meeting_id LIMIT 1;

  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', 'Talco - Meeting Invitation',
        'body', 'You are invited to: ' || COALESCE(m_title,'a meeting') || COALESCE(' on '||m_date,''),
        'url', '/meeting',
        'tag', 'meeting-'||NEW.id
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_push_on_meeting_notification ON public.meeting_notifications;
CREATE TRIGGER trigger_push_on_meeting_notification
AFTER INSERT ON public.meeting_notifications
FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_meeting_notification();

-- Shooting notifications -> push
CREATE OR REPLACE FUNCTION public.trigger_push_on_shooting_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  supabase_url TEXT; service_key TEXT; req_id BIGINT;
  s_title TEXT; s_date TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;

  SELECT title, to_char(shooting_date, 'DD Mon YYYY HH24:MI') INTO s_title, s_date
  FROM shooting_schedules WHERE id = NEW.shooting_id LIMIT 1;

  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', 'Talco - Shooting Request',
        'body', 'You are assigned to: ' || COALESCE(s_title,'a shooting') || COALESCE(' on '||s_date,'') || COALESCE(' as '||NEW.crew_role,''),
        'url', '/shooting',
        'tag', 'shooting-'||NEW.id
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_push_on_shooting_notification ON public.shooting_notifications;
CREATE TRIGGER trigger_push_on_shooting_notification
AFTER INSERT ON public.shooting_notifications
FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_shooting_notification();

-- Auto clock-out notifications -> push
CREATE OR REPLACE FUNCTION public.trigger_push_on_auto_clockout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  supabase_url TEXT; service_key TEXT; req_id BIGINT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;

  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', 'Talco - Auto Clock-Out',
        'body', COALESCE(NEW.message, 'You have been automatically clocked out'),
        'url', '/',
        'tag', 'autoclockout-'||NEW.id
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_push_on_auto_clockout ON public.auto_clockout_notifications;
CREATE TRIGGER trigger_push_on_auto_clockout
AFTER INSERT ON public.auto_clockout_notifications
FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_auto_clockout();

-- Announcements -> broadcast push to all users with subscriptions
CREATE OR REPLACE FUNCTION public.trigger_push_on_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  supabase_url TEXT; service_key TEXT; req_id BIGINT;
  uids UUID[];
BEGIN
  IF NEW.is_active = false THEN RETURN NEW; END IF;
  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;

  SELECT array_agg(DISTINCT user_id) INTO uids
  FROM public.push_subscriptions WHERE is_active = true;

  IF uids IS NULL OR array_length(uids,1) = 0 THEN RETURN NEW; END IF;

  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'user_ids', to_jsonb(uids),
        'title', 'Talco - ' || COALESCE(NEW.title, 'Announcement'),
        'body', LEFT(COALESCE(NEW.content,''), 200),
        'url', '/',
        'tag', 'announcement-'||NEW.id
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_push_on_announcement ON public.announcements;
CREATE TRIGGER trigger_push_on_announcement
AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_announcement();
