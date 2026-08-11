CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS last_message_time TIMESTAMPTZ;

CREATE TABLE public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  scheduled_for TIMESTAMPTZ NOT NULL,
  total_days SMALLINT NOT NULL DEFAULT 1 CHECK (total_days BETWEEN 1 AND 365),
  days_sent SMALLINT NOT NULL DEFAULT 0 CHECK (days_sent >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recurring', 'sent', 'failed')),
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  last_sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.scheduled_message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id UUID NOT NULL REFERENCES public.scheduled_messages(id) ON DELETE CASCADE,
  occurrence_number SMALLINT NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  delivered_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scheduled_message_id, occurrence_number)
);

CREATE INDEX scheduled_messages_due_idx
  ON public.scheduled_messages (scheduled_for)
  WHERE paused = FALSE AND status IN ('pending', 'recurring');

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_message_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their schedules"
  ON public.scheduled_messages FOR SELECT
  USING (sender_id = auth.uid());
CREATE POLICY "Users can create their schedules"
  ON public.scheduled_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND recipient_id <> auth.uid());
CREATE POLICY "Users can update their schedules"
  ON public.scheduled_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND recipient_id <> auth.uid());
CREATE POLICY "Users can delete their schedules"
  ON public.scheduled_messages FOR DELETE
  USING (sender_id = auth.uid());
CREATE POLICY "Users can view their schedule deliveries"
  ON public.scheduled_message_deliveries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.scheduled_messages sm
    WHERE sm.id = scheduled_message_id AND sm.sender_id = auth.uid()
  ));

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
        scheduled_message_id, occurrence_number, message_id, chat_id, delivered_at, status
      ) VALUES (
        scheduled_record.id, occurrence_number, created_message_id, target_chat_id, NOW(), 'sent'
      );

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

CREATE OR REPLACE FUNCTION public.send_scheduled_message_now(schedule_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  UPDATE public.scheduled_messages
  SET scheduled_for = NOW(), paused = FALSE,
      status = CASE WHEN days_sent > 0 THEN 'recurring' ELSE 'pending' END,
      last_error = NULL, updated_at = NOW()
  WHERE id = schedule_id AND sender_id = auth.uid() AND status <> 'sent';
  IF NOT FOUND THEN RETURN FALSE; END IF;
  PERFORM public.dispatch_due_scheduled_messages(schedule_id);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_due_scheduled_messages(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_scheduled_message_now(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_scheduled_message_now(UUID) TO authenticated;

SELECT cron.schedule(
  'dispatch-scheduled-messages',
  '* * * * *',
  'SELECT public.dispatch_due_scheduled_messages();'
);
