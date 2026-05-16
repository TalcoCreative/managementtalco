CREATE OR REPLACE FUNCTION public.is_chat_creator(_conv UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_conversations
    WHERE id = _conv
      AND created_by = _user
  );
$$;

DROP POLICY IF EXISTS "view conversations as participant" ON public.chat_conversations;
CREATE POLICY "view conversations as participant or creator"
ON public.chat_conversations
FOR SELECT
USING (
  created_by = auth.uid()
  OR public.is_chat_participant(id, auth.uid())
);

DROP POLICY IF EXISTS "update conversation by participant" ON public.chat_conversations;
CREATE POLICY "update conversation by participant or creator"
ON public.chat_conversations
FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.is_chat_participant(id, auth.uid())
);

CREATE OR REPLACE FUNCTION public.trigger_push_on_chat_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  supabase_url TEXT; service_key TEXT; req_id BIGINT;
  uids UUID[]; sender_name TEXT; conv_name TEXT; conv_type public.chat_conversation_type;
  push_title TEXT; push_body TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name='SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;

  SELECT array_agg(user_id) INTO uids
  FROM public.chat_participants
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id
    AND muted = false;

  IF uids IS NULL OR array_length(uids,1) = 0 THEN RETURN NEW; END IF;

  SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id LIMIT 1;
  SELECT name, type INTO conv_name, conv_type FROM public.chat_conversations WHERE id = NEW.conversation_id LIMIT 1;

  IF conv_type = 'group' THEN
    push_title := 'Talco Chat - ' || COALESCE(conv_name,'Group');
    push_body := COALESCE(sender_name,'Someone') || ': ' || LEFT(NEW.content, 140);
  ELSE
    push_title := 'Talco Chat - ' || COALESCE(sender_name,'New message');
    push_body := LEFT(NEW.content, 160);
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
        'tag', 'chat-' || NEW.conversation_id
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END $$;