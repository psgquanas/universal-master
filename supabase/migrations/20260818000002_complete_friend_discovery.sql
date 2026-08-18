-- Complete friend discovery, request responses, and actionable notifications.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS friend_request_id UUID REFERENCES public.friend_requests(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'friend_requests_valid_status'
      AND conrelid = 'public.friend_requests'::regclass
  ) THEN
    ALTER TABLE public.friend_requests
      ADD CONSTRAINT friend_requests_valid_status
      CHECK (status IN ('pending', 'accepted', 'declined')) NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_profiles_by_phone(contact_phones TEXT[])
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  username TEXT,
  bio_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.username, p.bio_status
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND p.phone IS NOT NULL
    AND regexp_replace(p.phone, '[^0-9]', '', 'g') = ANY (
      SELECT regexp_replace(value, '[^0-9]', '', 'g')
      FROM unnest(COALESCE(contact_phones, ARRAY[]::TEXT[])) AS value
    )
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.find_profiles_by_phone(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profiles_by_phone(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_friend_request(target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  request_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  IF target_user_id IS NULL OR target_user_id = current_user_id OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Invalid friend request recipient';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    LEAST(current_user_id::TEXT, target_user_id::TEXT) || ':' ||
    GREATEST(current_user_id::TEXT, target_user_id::TEXT), 0
  ));

  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user_a = current_user_id AND user_b = target_user_id)
       OR (user_a = target_user_id AND user_b = current_user_id)
  ) THEN
    RAISE EXCEPTION 'You are already friends';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE sender_id = target_user_id
      AND recipient_id = current_user_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'This user has already sent you a friend request';
  END IF;

  INSERT INTO public.friend_requests (sender_id, recipient_id, status, updated_at)
  VALUES (current_user_id, target_user_id, 'pending', NOW())
  ON CONFLICT (sender_id, recipient_id) DO UPDATE
    SET status = 'pending', updated_at = NOW()
    WHERE public.friend_requests.status = 'declined'
  RETURNING id INTO request_id;

  IF request_id IS NULL THEN
    SELECT id INTO request_id
    FROM public.friend_requests
    WHERE sender_id = current_user_id AND recipient_id = target_user_id AND status = 'pending';
  END IF;

  IF request_id IS NULL THEN
    RAISE EXCEPTION 'This friend request cannot be sent again';
  END IF;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_friend_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_friend_request(target_request_id UUID, response TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  request_row public.friend_requests%ROWTYPE;
  canonical_a UUID;
  canonical_b UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  IF response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Response must be accepted or declined';
  END IF;

  SELECT * INTO request_row
  FROM public.friend_requests
  WHERE id = target_request_id
    AND recipient_id = current_user_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This friend request is no longer pending';
  END IF;

  IF response = 'accepted' THEN
    canonical_a := LEAST(request_row.sender_id, request_row.recipient_id);
    canonical_b := GREATEST(request_row.sender_id, request_row.recipient_id);

    PERFORM pg_advisory_xact_lock(hashtextextended(canonical_a::TEXT || ':' || canonical_b::TEXT, 0));

    IF NOT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE (user_a = canonical_a AND user_b = canonical_b)
         OR (user_a = canonical_b AND user_b = canonical_a)
    ) THEN
      INSERT INTO public.friendships (user_a, user_b) VALUES (canonical_a, canonical_b);
    END IF;
  END IF;

  UPDATE public.friend_requests
  SET status = response, updated_at = NOW()
  WHERE id = request_row.id;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, NOW())
  WHERE recipient_id = current_user_id
    AND friend_request_id = request_row.id;

  RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_friend_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Users can update requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can insert requests" ON public.friend_requests;
CREATE POLICY "Users can send pending friend requests"
ON public.friend_requests FOR INSERT
WITH CHECK (auth.uid() = sender_id AND status = 'pending' AND sender_id <> recipient_id);
CREATE POLICY "Recipients can update friend requests"
ON public.friend_requests FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can insert friendships" ON public.friendships;

CREATE OR REPLACE FUNCTION public.create_connection_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, title, body, message, friend_request_id, data)
    VALUES (
      NEW.recipient_id,
      NEW.sender_id,
      'friend_request',
      'Friend request',
      'sent you a friend request',
      'sent you a friend request',
      NEW.id,
      jsonb_build_object('friend_request_id', NEW.id)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'pending' AND OLD.status = 'declined' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, title, body, message, friend_request_id, data)
    VALUES (
      NEW.recipient_id,
      NEW.sender_id,
      'friend_request',
      'Friend request',
      'sent you a friend request',
      'sent you a friend request',
      NEW.id,
      jsonb_build_object('friend_request_id', NEW.id)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, title, body, message, friend_request_id, data)
    VALUES (
      NEW.sender_id,
      NEW.recipient_id,
      'friend_accepted',
      'Friend request accepted',
      'accepted your friend request',
      'accepted your friend request',
      NEW.id,
      jsonb_build_object('friend_request_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.notifications n
SET friend_request_id = fr.id,
    data = COALESCE(n.data, '{}'::JSONB) || jsonb_build_object('friend_request_id', fr.id)
FROM public.friend_requests fr
WHERE n.type = 'friend_request'
  AND n.friend_request_id IS NULL
  AND n.actor_id = fr.sender_id
  AND n.recipient_id = fr.recipient_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'friend_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
  END IF;
END $$;
