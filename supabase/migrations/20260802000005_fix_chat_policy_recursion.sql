CREATE OR REPLACE FUNCTION public.is_chat_participant(target_chat_id UUID, target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = target_chat_id AND profile_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chat_admin(target_chat_id UUID, target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = target_chat_id AND profile_id = target_user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_send_to_chat(target_chat_id UUID, target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants cp
    JOIN public.chats c ON c.id = cp.chat_id
    WHERE cp.chat_id = target_chat_id
      AND cp.profile_id = target_user_id
      AND (c.type = 'individual' OR cp.role = 'admin' OR c.allow_members_send = TRUE)
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_participant(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_chat_admin(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_send_to_chat(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_to_chat(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;
CREATE POLICY "Users can view their chats" ON public.chats FOR SELECT
USING (public.is_chat_participant(id));

DROP POLICY IF EXISTS "Users can view participants of their chats" ON public.chat_participants;
CREATE POLICY "Users can view participants of their chats" ON public.chat_participants FOR SELECT
USING (public.is_chat_participant(chat_id));

DROP POLICY IF EXISTS "Users can add participants" ON public.chat_participants;
CREATE POLICY "Users can add participants" ON public.chat_participants FOR INSERT
WITH CHECK (profile_id = auth.uid() OR public.is_chat_admin(chat_id));

DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
CREATE POLICY "Users can view messages in their chats" ON public.messages FOR SELECT
USING (public.is_chat_participant(chat_id));

DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
CREATE POLICY "Users can insert messages in their chats" ON public.messages FOR INSERT
WITH CHECK (sender_id = auth.uid() AND public.can_send_to_chat(chat_id));
