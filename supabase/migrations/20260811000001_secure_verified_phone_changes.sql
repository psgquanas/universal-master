ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.phone_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_phone TEXT,
  new_phone TEXT NOT NULL,
  verification_method TEXT NOT NULL DEFAULT 'email_otp',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.phone_change_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their phone change history"
  ON public.phone_change_audit FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.protect_profile_phone_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone
    AND auth.uid() IS NOT NULL
    AND COALESCE(current_setting('app.verified_phone_change_user', TRUE), '') <> auth.uid()::TEXT
  THEN
    RAISE EXCEPTION 'Phone changes require recent email verification';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_phone_change ON public.profiles;
CREATE TRIGGER protect_profile_phone_change
  BEFORE UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_phone_change();

CREATE OR REPLACE FUNCTION public.change_phone_after_email_verification(new_phone TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  normalized_phone TEXT := regexp_replace(new_phone, '[\s().-]', '', 'g');
  current_phone TEXT;
  updated_profile public.profiles%ROWTYPE;
  has_recent_email_otp BOOLEAN;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF normalized_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'Enter a valid international phone number, including the country code';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(auth.jwt() -> 'amr', '[]'::JSONB)) AS method
    WHERE method ->> 'method' IN ('otp', 'magiclink')
      AND COALESCE((method ->> 'timestamp')::BIGINT, 0) >= EXTRACT(EPOCH FROM NOW() - INTERVAL '10 minutes')::BIGINT
  ) INTO has_recent_email_otp;

  IF NOT has_recent_email_otp THEN
    RAISE EXCEPTION 'A recent email verification code is required';
  END IF;

  SELECT phone INTO current_phone
  FROM public.profiles
  WHERE id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF normalized_phone IS NOT DISTINCT FROM current_phone THEN
    RAISE EXCEPTION 'The new phone number matches your current number';
  END IF;

  PERFORM set_config('app.verified_phone_change_user', current_user_id::TEXT, TRUE);

  UPDATE public.profiles
  SET phone = normalized_phone,
      phone_verified_at = NOW(),
      updated_at = NOW()
  WHERE id = current_user_id
  RETURNING * INTO updated_profile;

  INSERT INTO public.phone_change_audit (user_id, previous_phone, new_phone)
  VALUES (current_user_id, current_phone, normalized_phone);

  RETURN updated_profile;
END;
$$;

REVOKE ALL ON public.phone_change_audit FROM anon, authenticated;
GRANT SELECT ON public.phone_change_audit TO authenticated;
REVOKE ALL ON FUNCTION public.change_phone_after_email_verification(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_phone_after_email_verification(TEXT) TO authenticated;
