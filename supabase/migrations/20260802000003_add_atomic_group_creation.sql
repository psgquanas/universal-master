CREATE OR REPLACE FUNCTION public.create_group_chat(group_name TEXT, participant_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_id UUID := auth.uid();
  new_chat_id UUID;
  member_id UUID;
BEGIN
  IF creator_id IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF char_length(btrim(group_name)) = 0 OR char_length(btrim(group_name)) > 100 THEN
    RAISE EXCEPTION 'Group name must be between 1 and 100 characters';
  END IF;
  IF participant_ids IS NULL OR cardinality(participant_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one group member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(participant_ids) requested_id
    WHERE requested_id = creator_id
       OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = requested_id)
  ) THEN
    RAISE EXCEPTION 'One or more selected members are invalid';
  END IF;

  INSERT INTO public.chats (type, name)
  VALUES ('group', btrim(group_name))
  RETURNING id INTO new_chat_id;

  INSERT INTO public.chat_participants (chat_id, profile_id, role)
  VALUES (new_chat_id, creator_id, 'admin');

  FOR member_id IN SELECT DISTINCT unnest(participant_ids)
  LOOP
    INSERT INTO public.chat_participants (chat_id, profile_id, role)
    VALUES (new_chat_id, member_id, 'member');
  END LOOP;

  RETURN new_chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_chat(TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_chat(TEXT, UUID[]) TO authenticated;
