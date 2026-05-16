
CREATE OR REPLACE FUNCTION public.trigger_push_on_chat_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url TEXT; service_key TEXT; req_id BIGINT;
  sender_id UUID; conv_id UUID; sender_name TEXT; conv_name TEXT;
  conv_type public.chat_conversation_type;
  push_title TEXT; push_body TEXT;
BEGIN
  -- Only push for user mentions
  IF NEW.mention_type::text <> 'user' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;

  SELECT sender_id, conversation_id INTO sender_id, conv_id
  FROM public.chat_messages WHERE id = NEW.message_id LIMIT 1;

  -- Don't notify self-mentions
  IF sender_id = NEW.entity_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO sender_name FROM public.profiles WHERE id = sender_id LIMIT 1;
  SELECT name, type INTO conv_name, conv_type FROM public.chat_conversations WHERE id = conv_id LIMIT 1;

  push_title := 'Talco Chat - You were mentioned';
  IF conv_type = 'group' THEN
    push_body := COALESCE(sender_name,'Someone') || ' mentioned you in ' || COALESCE(conv_name,'a group');
  ELSE
    push_body := COALESCE(sender_name,'Someone') || ' mentioned you';
  END IF;

  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'user_id', NEW.entity_id,
        'title', push_title,
        'body', push_body,
        'url', '/chat?chat=' || conv_id,
        'tag', 'chat-mention-' || NEW.id
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_push_on_chat_mention ON public.chat_message_mentions;
CREATE TRIGGER trg_push_on_chat_mention
AFTER INSERT ON public.chat_message_mentions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_chat_mention();
