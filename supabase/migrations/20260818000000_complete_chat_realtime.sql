-- Complete the durable and ephemeral realtime model for chat.

ALTER TABLE public.chat_participants
  ADD COLUMN IF NOT EXISTS last_delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.push_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their push tokens" ON public.push_tokens;
CREATE POLICY "Users can view their push tokens" ON public.push_tokens
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete their push tokens" ON public.push_tokens
FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_push_token(
  push_token TEXT,
  installation_id TEXT,
  device_platform TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF push_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' THEN RAISE EXCEPTION 'Invalid Expo push token'; END IF;
  IF device_platform NOT IN ('android', 'ios') THEN RAISE EXCEPTION 'Invalid device platform'; END IF;

  INSERT INTO public.push_tokens(token, user_id, device_id, platform, updated_at)
  VALUES (push_token, auth.uid(), installation_id, device_platform, NOW())
  ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    device_id = EXCLUDED.device_id,
    platform = EXCLUDED.platform,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_chat_summaries()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(summary) ORDER BY summary.sort_time DESC), '[]'::JSONB)
  FROM (
    SELECT
      c.id,
      c.type::TEXT AS type,
      c.name,
      c.description,
      c.image_url,
      c.created_at,
      c.last_message_time,
      COALESCE(c.last_message_time, c.created_at) AS sort_time,
      latest.content AS last_message_content,
      latest.sender_id AS last_message_sender_id,
      latest.created_at AS last_message_created_at,
      CASE WHEN c.type = 'individual' THEN (
        SELECT jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'bio_status', p.bio_status,
          'last_seen', p.last_seen
        )
        FROM public.chat_participants other
        JOIN public.profiles p ON p.id = other.profile_id
        WHERE other.chat_id = c.id AND other.profile_id <> auth.uid()
        LIMIT 1
      ) END AS other_user,
      (
        SELECT COUNT(*)
        FROM public.messages unread
        WHERE unread.chat_id = c.id
          AND unread.sender_id <> auth.uid()
          AND unread.created_at > mine.last_read_at
      ) AS unread_count,
      CASE
        WHEN latest.sender_id IS DISTINCT FROM auth.uid() THEN NULL
        WHEN NOT EXISTS (
          SELECT 1 FROM public.chat_participants recipient
          WHERE recipient.chat_id = c.id AND recipient.profile_id <> auth.uid()
            AND recipient.last_read_at < latest.created_at
        ) THEN 'read'
        WHEN NOT EXISTS (
          SELECT 1 FROM public.chat_participants recipient
          WHERE recipient.chat_id = c.id AND recipient.profile_id <> auth.uid()
            AND recipient.last_delivered_at < latest.created_at
        ) THEN 'delivered'
        ELSE 'sent'
      END AS last_message_status
    FROM public.chat_participants mine
    JOIN public.chats c ON c.id = mine.chat_id
    LEFT JOIN LATERAL (
      SELECT m.content, m.sender_id, m.created_at
      FROM public.messages m
      WHERE m.chat_id = c.id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE mine.profile_id = auth.uid()
  ) summary;
$$;

REVOKE ALL ON FUNCTION public.get_chat_summaries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_summaries() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_chat_delivered(target_chat_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  UPDATE public.chat_participants
  SET last_delivered_at = NOW()
  WHERE chat_id = target_chat_id AND profile_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_chats_delivered()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  UPDATE public.chat_participants
  SET last_delivered_at = NOW()
  WHERE profile_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_chat_read(target_chat_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  UPDATE public.chat_participants
  SET last_read_at = NOW(), last_delivered_at = NOW()
  WHERE chat_id = target_chat_id AND profile_id = auth.uid();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_delivered(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_chats_delivered() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_chat_delivered(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_chats_delivered() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_chat_room(chat_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_chat_participant(chat_id_input) THEN
    RAISE EXCEPTION 'You are not a member of this chat';
  END IF;
  SELECT jsonb_build_object(
    'id', c.id, 'type', c.type, 'name', c.name, 'description', c.description, 'image_url', c.image_url,
    'allow_members_send', c.allow_members_send,
    'current_user_role', (SELECT cp.role::TEXT FROM public.chat_participants cp WHERE cp.chat_id = c.id AND cp.profile_id = auth.uid()),
    'participants', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'username', p.username, 'avatar_url', p.avatar_url,
        'last_read_at', cp.last_read_at, 'last_delivered_at', cp.last_delivered_at
      ))
      FROM public.chat_participants cp
      JOIN public.profiles p ON p.id = cp.profile_id
      WHERE cp.chat_id = c.id
    )
  ) INTO result FROM public.chats c WHERE c.id = chat_id_input;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_chat_room(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_room(UUID) TO authenticated;

-- Authorize Broadcast and Presence only for authenticated chat members.
DROP POLICY IF EXISTS "Chat members can receive ephemeral events" ON realtime.messages;
CREATE POLICY "Chat members can receive ephemeral events"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.profile_id = auth.uid()
      AND (SELECT realtime.topic()) = 'chat:' || cp.chat_id::TEXT
  )
);

DROP POLICY IF EXISTS "Chat members can send ephemeral events" ON realtime.messages;
CREATE POLICY "Chat members can send ephemeral events"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.profile_id = auth.uid()
      AND (SELECT realtime.topic()) = 'chat:' || cp.chat_id::TEXT
  )
);

-- Publish tables used by client Postgres Change listeners.
DO $$
DECLARE target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['notifications', 'chat_participants', 'chats']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = target_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
    END IF;
  END LOOP;
END $$;

-- Queue mobile push notifications directly through Expo's HTTPS service.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.send_new_message_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  recipient_token RECORD;
  sender_name TEXT;
  notification_body TEXT;
BEGIN
  SELECT COALESCE(full_name, username, 'New message') INTO sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  notification_body := CASE
    WHEN NEW.content_type = 'text' THEN LEFT(NEW.content, 140)
    WHEN NEW.content_type = 'image' THEN 'Sent a photo'
    WHEN NEW.content_type = 'voice' THEN 'Sent a voice message'
    ELSE 'Sent a message'
  END;

  FOR recipient_token IN
    SELECT pt.token
    FROM public.chat_participants cp
    JOIN public.push_tokens pt ON pt.user_id = cp.profile_id
    WHERE cp.chat_id = NEW.chat_id AND cp.profile_id <> NEW.sender_id
  LOOP
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type":"application/json"}'::JSONB,
      body := jsonb_build_object(
        'to', recipient_token.token,
        'title', sender_name,
        'body', notification_body,
        'sound', 'default',
        'channelId', 'messages',
        'data', jsonb_build_object('url', '/(chat)/' || NEW.chat_id::TEXT, 'chatId', NEW.chat_id::TEXT)
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS send_new_message_push ON public.messages;
CREATE TRIGGER send_new_message_push
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.send_new_message_push();
