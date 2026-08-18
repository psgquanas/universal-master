-- Make scheduled delivery recoverable, timezone-safe, live, and authorization-complete.

ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS retry_count SMALLINT NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.are_friends(first_user UUID, second_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user_a = first_user AND user_b = second_user)
       OR (user_a = second_user AND user_b = first_user)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_valid_timezone(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = candidate);
$$;

REVOKE ALL ON FUNCTION public.are_friends(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_timezone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_timezone(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Users can create their schedules" ON public.scheduled_messages;
CREATE POLICY "Users can create their schedules"
ON public.scheduled_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND recipient_id <> auth.uid()
  AND public.are_friends(auth.uid(), recipient_id)
  AND public.is_valid_timezone(timezone)
);

DROP POLICY IF EXISTS "Users can update their schedules" ON public.scheduled_messages;
CREATE POLICY "Users can update their schedules"
ON public.scheduled_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (
  sender_id = auth.uid()
  AND recipient_id <> auth.uid()
  AND (paused = TRUE OR public.are_friends(auth.uid(), recipient_id))
  AND public.is_valid_timezone(timezone)
);

CREATE OR REPLACE FUNCTION public.dispatch_due_scheduled_messages(target_schedule_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  scheduled_record public.scheduled_messages%ROWTYPE;
  target_chat_id UUID;
  created_message_id UUID;
  occurrence_number SMALLINT;
  processed_count INTEGER := 0;
BEGIN
  FOR scheduled_record IN
    SELECT * FROM public.scheduled_messages
    WHERE paused = FALSE
      AND status IN ('pending', 'recurring')
      AND scheduled_for <= NOW()
      AND (target_schedule_id IS NULL OR id = target_schedule_id)
      AND (auth.uid() IS NULL OR sender_id = auth.uid())
    ORDER BY scheduled_for
    FOR UPDATE SKIP LOCKED
  LOOP
    occurrence_number := scheduled_record.days_sent + 1;
    BEGIN
      UPDATE public.scheduled_messages
      SET last_attempt_at = NOW(), updated_at = NOW()
      WHERE id = scheduled_record.id;

      IF NOT public.are_friends(scheduled_record.sender_id, scheduled_record.recipient_id) THEN
        RAISE EXCEPTION 'The recipient is no longer connected to you';
      END IF;

      IF NOT public.is_valid_timezone(scheduled_record.timezone) THEN
        RAISE EXCEPTION 'The schedule timezone is invalid';
      END IF;

      SELECT c.id INTO target_chat_id
      FROM public.chats c
      WHERE c.type = 'individual'
        AND EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.chat_id = c.id AND cp.profile_id = scheduled_record.sender_id)
        AND EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.chat_id = c.id AND cp.profile_id = scheduled_record.recipient_id)
        AND (SELECT COUNT(*) FROM public.chat_participants cp WHERE cp.chat_id = c.id) = 2
      LIMIT 1;

      IF target_chat_id IS NULL THEN
        INSERT INTO public.chats (type) VALUES ('individual') RETURNING id INTO target_chat_id;
        INSERT INTO public.chat_participants (chat_id, profile_id)
        VALUES (target_chat_id, scheduled_record.sender_id), (target_chat_id, scheduled_record.recipient_id);
      END IF;

      INSERT INTO public.messages (chat_id, sender_id, content_type, content)
      VALUES (target_chat_id, scheduled_record.sender_id, 'text', scheduled_record.content)
      RETURNING id INTO created_message_id;

      INSERT INTO public.scheduled_message_deliveries (
        scheduled_message_id, occurrence_number, message_id, chat_id, delivered_at, status, error
      ) VALUES (
        scheduled_record.id, occurrence_number, created_message_id, target_chat_id, NOW(), 'sent', NULL
      ) ON CONFLICT (scheduled_message_id, occurrence_number)
      DO UPDATE SET message_id = EXCLUDED.message_id, chat_id = EXCLUDED.chat_id,
        delivered_at = EXCLUDED.delivered_at, status = 'sent', error = NULL;

      UPDATE public.scheduled_messages
      SET days_sent = occurrence_number,
          last_sent_at = NOW(),
          last_attempt_at = NOW(),
          retry_count = 0,
          last_error = NULL,
          status = CASE WHEN occurrence_number >= total_days THEN 'sent' ELSE 'recurring' END,
          scheduled_for = CASE
            WHEN occurrence_number >= total_days THEN scheduled_record.scheduled_for
            ELSE ((scheduled_record.scheduled_for AT TIME ZONE scheduled_record.timezone) + INTERVAL '1 day') AT TIME ZONE scheduled_record.timezone
          END,
          updated_at = NOW()
      WHERE id = scheduled_record.id;
      processed_count := processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.scheduled_message_deliveries (
        scheduled_message_id, occurrence_number, status, error
      ) VALUES (
        scheduled_record.id, occurrence_number, 'failed', SQLERRM
      ) ON CONFLICT (scheduled_message_id, occurrence_number)
      DO UPDATE SET status = 'failed', error = EXCLUDED.error, created_at = NOW();

      UPDATE public.scheduled_messages
      SET retry_count = LEAST(retry_count + 1, 5),
          last_attempt_at = NOW(),
          status = CASE WHEN retry_count + 1 >= 5 THEN 'failed' ELSE status END,
          last_error = SQLERRM,
          updated_at = NOW()
      WHERE id = scheduled_record.id;
    END;
  END LOOP;
  RETURN processed_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_scheduled_message_now(schedule_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  processed_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  UPDATE public.scheduled_messages
  SET scheduled_for = NOW(), paused = FALSE,
      status = CASE WHEN days_sent > 0 THEN 'recurring' ELSE 'pending' END,
      retry_count = 0, last_error = NULL, updated_at = NOW()
  WHERE id = schedule_id AND sender_id = auth.uid() AND status <> 'sent';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT public.dispatch_due_scheduled_messages(schedule_id) INTO processed_count;
  RETURN processed_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_due_scheduled_messages(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_scheduled_message_now(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_scheduled_message_now(UUID) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scheduled_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;
  END IF;
END $$;

-- Scheduling the same case-sensitive job name replaces and reactivates it.
SELECT cron.schedule(
  'dispatch-scheduled-messages',
  '* * * * *',
  'SELECT public.dispatch_due_scheduled_messages();'
);
