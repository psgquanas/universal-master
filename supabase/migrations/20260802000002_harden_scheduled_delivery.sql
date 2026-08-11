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

      UPDATE public.chats SET last_message_time = NOW() WHERE id = target_chat_id;

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
          last_error = NULL,
          status = CASE WHEN occurrence_number >= total_days THEN 'sent' ELSE 'recurring' END,
          scheduled_for = CASE WHEN occurrence_number >= total_days THEN scheduled_for ELSE scheduled_for + INTERVAL '1 day' END,
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
      SET status = 'failed', last_error = SQLERRM, updated_at = NOW()
      WHERE id = scheduled_record.id;
    END;
  END LOOP;
  RETURN processed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_due_scheduled_messages(UUID) FROM PUBLIC, anon, authenticated;
