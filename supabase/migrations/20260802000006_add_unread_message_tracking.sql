CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.messages m
  JOIN public.chat_participants mine ON mine.chat_id = m.chat_id AND mine.profile_id = auth.uid()
  WHERE m.sender_id <> auth.uid()
    AND m.created_at > mine.last_read_at;
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
  SET last_read_at = NOW()
  WHERE chat_id = target_chat_id AND profile_id = auth.uid();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unread_message_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_chat_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(UUID) TO authenticated;
