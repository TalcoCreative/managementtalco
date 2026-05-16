-- Rewrite chat message push trigger with diagnostic logging
CREATE OR REPLACE FUNCTION public.trigger_push_on_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url TEXT; service_key TEXT; req_id BIGINT;
  uids UUID[]; sender_name TEXT; conv_name TEXT; conv_type public.chat_conversation_type;
  push_title TEXT; push_body TEXT;
  err_text TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_text = MESSAGE_TEXT;
    INSERT INTO public.push_notification_logs(user_ids,title,body,url,tag,status,error_details,triggered_by)
    VALUES (ARRAY[]::uuid[], 'chat', '', '/chat', 'chat-'||NEW.id, 'failed', 'vault read error: '||err_text, 'chat_trigger');
    RETURN NEW;
  END;

  IF supabase_url IS NULL OR supabase_url = '' OR service_key IS NULL OR service_key = '' THEN
    INSERT INTO public.push_notification_logs(user_ids,title,body,url,tag,status,error_details,triggered_by)
    VALUES (ARRAY[]::uuid[], 'chat', '', '/chat', 'chat-'||NEW.id, 'failed', 'vault secrets missing', 'chat_trigger');
    RETURN NEW;
  END IF;

  SELECT array_agg(user_id) INTO uids
  FROM public.chat_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id
    AND COALESCE(muted,false) = false;

  IF uids IS NULL OR array_length(uids,1) = 0 THEN
    INSERT INTO public.push_notification_logs(user_ids,title,body,url,tag,status,error_details,triggered_by)
    VALUES (ARRAY[]::uuid[], 'chat', '', '/chat', 'chat-'||NEW.id, 'no_subscribers', 'no other participants', 'chat_trigger');
    RETURN NEW;
  END IF;

  SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id LIMIT 1;
  SELECT name, type INTO conv_name, conv_type FROM public.chat_conversations WHERE id = NEW.conversation_id LIMIT 1;

  IF conv_type = 'group' THEN
    push_title := 'Talco Chat - ' || COALESCE(conv_name,'Group');
    push_body := COALESCE(sender_name,'Someone') || ': ' || LEFT(COALESCE(NEW.content,''), 140);
  ELSE
    push_title := 'Talco Chat - ' || COALESCE(sender_name,'New message');
    push_body := LEFT(COALESCE(NEW.content,''), 160);
  END IF;

  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/send-web-push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'user_ids', to_jsonb(uids),
        'title', push_title,
        'body', push_body,
        'url', '/chat?chat=' || NEW.conversation_id,
        'tag', 'chat-' || NEW.conversation_id,
        'triggered_by', 'chat_trigger'
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_text = MESSAGE_TEXT;
    INSERT INTO public.push_notification_logs(user_ids,title,body,url,tag,status,error_details,triggered_by)
    VALUES (uids, push_title, push_body, '/chat?chat='||NEW.conversation_id, 'chat-'||NEW.conversation_id, 'failed', 'http_post error: '||err_text, 'chat_trigger');
  END;

  RETURN NEW;
END $function$;

-- Rewrite mention trigger: fix variable name collision (sender_id) and add logging
CREATE OR REPLACE FUNCTION public.trigger_push_on_chat_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url TEXT; service_key TEXT; req_id BIGINT;
  v_sender_id UUID; v_conv_id UUID; sender_name TEXT; conv_name TEXT;
  conv_type public.chat_conversation_type;
  push_title TEXT; push_body TEXT;
  err_text TEXT;
BEGIN
  IF NEW.mention_type::text <> 'user' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;

  SELECT m.sender_id, m.conversation_id INTO v_sender_id, v_conv_id
  FROM public.chat_messages m WHERE m.id = NEW.message_id LIMIT 1;

  IF v_sender_id = NEW.entity_id THEN RETURN NEW; END IF;

  SELECT full_name INTO sender_name FROM public.profiles WHERE id = v_sender_id LIMIT 1;
  SELECT name, type INTO conv_name, conv_type FROM public.chat_conversations WHERE id = v_conv_id LIMIT 1;

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
        'url', '/chat?chat=' || v_conv_id,
        'tag', 'chat-mention-' || NEW.id,
        'triggered_by', 'chat_mention_trigger'
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_text = MESSAGE_TEXT;
    INSERT INTO public.push_notification_logs(user_ids,title,body,url,tag,status,error_details,triggered_by)
    VALUES (ARRAY[NEW.entity_id]::uuid[], push_title, push_body, '/chat?chat='||v_conv_id, 'chat-mention-'||NEW.id, 'failed', 'http_post error: '||err_text, 'chat_mention_trigger');
  END;

  RETURN NEW;
END $function$;