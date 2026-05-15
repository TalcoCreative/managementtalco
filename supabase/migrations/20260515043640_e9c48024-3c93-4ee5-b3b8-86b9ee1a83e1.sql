
-- ============= TYPES =============
DO $$ BEGIN
  CREATE TYPE public.chat_conversation_type AS ENUM ('dm','group');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_participant_role AS ENUM ('admin','member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_mention_type AS ENUM (
    'user','task','project','shooting','meeting','event',
    'client','prospect','kol','editorial_plan'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============= TABLES =============
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.chat_conversation_type NOT NULL DEFAULT 'dm',
  name TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.chat_participant_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  muted BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conv ON public.chat_participants(conversation_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_message_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  mention_type public.chat_mention_type NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_msg ON public.chat_message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_mentions_entity ON public.chat_message_mentions(mention_type, entity_id);

-- ============= HELPER FN (avoid recursive RLS) =============
CREATE OR REPLACE FUNCTION public.is_chat_participant(_conv UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = _conv AND user_id = _user
  );
$$;

-- ============= RLS =============
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_mentions ENABLE ROW LEVEL SECURITY;

-- conversations
CREATE POLICY "view conversations as participant"
ON public.chat_conversations FOR SELECT
USING (public.is_chat_participant(id, auth.uid()));

CREATE POLICY "create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "update conversation by participant"
ON public.chat_conversations FOR UPDATE
USING (public.is_chat_participant(id, auth.uid()));

CREATE POLICY "delete conversation by creator"
ON public.chat_conversations FOR DELETE
USING (created_by = auth.uid());

-- participants
CREATE POLICY "view participants of own conversations"
ON public.chat_participants FOR SELECT
USING (public.is_chat_participant(conversation_id, auth.uid()));

CREATE POLICY "add participants if member"
ON public.chat_participants FOR INSERT
WITH CHECK (
  public.is_chat_participant(conversation_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  )
);

CREATE POLICY "update own participant row"
ON public.chat_participants FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "remove self or by admin"
ON public.chat_participants FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_participants p
    WHERE p.conversation_id = chat_participants.conversation_id
      AND p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- messages
CREATE POLICY "view messages as participant"
ON public.chat_messages FOR SELECT
USING (public.is_chat_participant(conversation_id, auth.uid()));

CREATE POLICY "send messages as participant"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_chat_participant(conversation_id, auth.uid())
);

CREATE POLICY "edit own messages"
ON public.chat_messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "delete own messages"
ON public.chat_messages FOR DELETE
USING (sender_id = auth.uid());

-- mentions
CREATE POLICY "view mentions in own conversations"
ON public.chat_message_mentions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id
      AND public.is_chat_participant(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "add mentions to own messages"
ON public.chat_message_mentions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = message_id AND m.sender_id = auth.uid()
  )
);

-- ============= TRIGGERS =============

-- bump conversation last_message_at
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversations
    SET last_message_at = NEW.created_at, updated_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_conv_last_msg ON public.chat_messages;
CREATE TRIGGER trg_bump_conv_last_msg
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- push notification to all participants except sender
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
        'url', '/?chat=' || NEW.conversation_id,
        'tag', 'chat-' || NEW.conversation_id
      )
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_push_on_chat_message ON public.chat_messages;
CREATE TRIGGER trg_push_on_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_chat_message();

-- realtime
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_participants REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
