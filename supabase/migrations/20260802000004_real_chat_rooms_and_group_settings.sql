ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS allow_members_edit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_members_send BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_members_add BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('group-images', 'group-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;
CREATE POLICY "Group images are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'group-images');
CREATE POLICY "Users can upload group images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'group-images' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
CREATE POLICY "Users can update group images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'group-images' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE OR REPLACE FUNCTION public.get_or_create_individual_chat(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE current_user_id UUID := auth.uid(); target_chat_id UUID;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF other_user_id = current_user_id OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'Invalid chat recipient';
  END IF;
  SELECT c.id INTO target_chat_id FROM public.chats c
  WHERE c.type = 'individual'
    AND EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.chat_id = c.id AND cp.profile_id = current_user_id)
    AND EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.chat_id = c.id AND cp.profile_id = other_user_id)
    AND (SELECT COUNT(*) FROM public.chat_participants cp WHERE cp.chat_id = c.id) = 2
  LIMIT 1;
  IF target_chat_id IS NULL THEN
    INSERT INTO public.chats(type) VALUES ('individual') RETURNING id INTO target_chat_id;
    INSERT INTO public.chat_participants(chat_id, profile_id) VALUES (target_chat_id, current_user_id), (target_chat_id, other_user_id);
  END IF;
  RETURN target_chat_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_individual_chat(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_individual_chat(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.create_group_chat(TEXT, UUID[]);
CREATE FUNCTION public.create_group_chat(
  group_name TEXT, participant_ids UUID[], group_description TEXT DEFAULT NULL,
  group_image_url TEXT DEFAULT NULL, members_can_edit BOOLEAN DEFAULT FALSE,
  members_can_send BOOLEAN DEFAULT TRUE, members_can_add BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE creator_id UUID := auth.uid(); new_chat_id UUID; member_id UUID;
BEGIN
  IF creator_id IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF char_length(btrim(group_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Group name must be between 1 and 100 characters'; END IF;
  IF participant_ids IS NULL OR cardinality(participant_ids) = 0 THEN RAISE EXCEPTION 'Select at least one group member'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(participant_ids) requested_id WHERE requested_id = creator_id OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = requested_id)) THEN
    RAISE EXCEPTION 'One or more selected members are invalid';
  END IF;
  INSERT INTO public.chats(type, name, description, image_url, allow_members_edit, allow_members_send, allow_members_add)
  VALUES ('group', btrim(group_name), NULLIF(btrim(group_description), ''), group_image_url, members_can_edit, members_can_send, members_can_add)
  RETURNING id INTO new_chat_id;
  INSERT INTO public.chat_participants(chat_id, profile_id, role) VALUES (new_chat_id, creator_id, 'admin');
  FOR member_id IN SELECT DISTINCT unnest(participant_ids) LOOP
    INSERT INTO public.chat_participants(chat_id, profile_id, role) VALUES (new_chat_id, member_id, 'member');
    INSERT INTO public.notifications(recipient_id, actor_id, type, title, body, data)
    VALUES (member_id, creator_id, 'group_added', 'Added to a group', 'You were added to ' || btrim(group_name), jsonb_build_object('chat_id', new_chat_id));
  END LOOP;
  RETURN new_chat_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_group_chat(TEXT, UUID[], TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_chat(TEXT, UUID[], TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_chat_room(chat_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_id = chat_id_input AND profile_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are not a member of this chat';
  END IF;
  SELECT jsonb_build_object(
    'id', c.id, 'type', c.type, 'name', c.name, 'description', c.description, 'image_url', c.image_url,
    'allow_members_send', c.allow_members_send,
    'current_user_role', (SELECT cp.role::TEXT FROM public.chat_participants cp WHERE cp.chat_id = c.id AND cp.profile_id = auth.uid()),
    'participants', (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'username', p.username, 'avatar_url', p.avatar_url)) FROM public.chat_participants cp JOIN public.profiles p ON p.id = cp.profile_id WHERE cp.chat_id = c.id)
  ) INTO result FROM public.chats c WHERE c.id = chat_id_input;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_chat_room(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_room(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
CREATE POLICY "Users can insert messages in their chats" ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.chat_participants mine JOIN public.chats c ON c.id = mine.chat_id
    WHERE mine.chat_id = messages.chat_id AND mine.profile_id = auth.uid()
      AND (c.type = 'individual' OR mine.role = 'admin' OR c.allow_members_send = TRUE)
  )
);

CREATE OR REPLACE FUNCTION public.touch_chat_after_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chats SET last_message_time = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_message_touch_chat ON public.messages;
CREATE TRIGGER on_message_touch_chat AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_chat_after_message();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
