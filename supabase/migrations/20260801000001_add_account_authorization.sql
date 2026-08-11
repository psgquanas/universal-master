CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.account_authorization_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash BYTEA NOT NULL,
  salt BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts_remaining SMALLINT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_authorization_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.issue_account_authorization_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  random_bytes BYTEA;
  plain_code TEXT;
  code_salt BYTEA;
  random_number BIGINT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  random_bytes := gen_random_bytes(4);
  random_number := get_byte(random_bytes, 0)::BIGINT * 16777216
    + get_byte(random_bytes, 1)::BIGINT * 65536
    + get_byte(random_bytes, 2)::BIGINT * 256
    + get_byte(random_bytes, 3)::BIGINT;
  plain_code := (100000 + (random_number % 900000))::TEXT;
  code_salt := gen_random_bytes(32);

  INSERT INTO public.account_authorization_codes (
    user_id, code_hash, salt, expires_at, attempts_remaining, created_at
  ) VALUES (
    current_user_id,
    digest(convert_to(plain_code, 'UTF8') || code_salt, 'sha256'),
    code_salt,
    NOW() + INTERVAL '10 minutes',
    5,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    code_hash = EXCLUDED.code_hash,
    salt = EXCLUDED.salt,
    expires_at = EXCLUDED.expires_at,
    attempts_remaining = EXCLUDED.attempts_remaining,
    created_at = EXCLUDED.created_at;

  RETURN plain_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_account_authorization_code(submitted_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  stored_code public.account_authorization_codes%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT * INTO stored_code
  FROM public.account_authorization_codes
  WHERE user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND OR stored_code.expires_at <= NOW() OR stored_code.attempts_remaining <= 0 THEN
    DELETE FROM public.account_authorization_codes WHERE user_id = current_user_id;
    RETURN FALSE;
  END IF;

  IF stored_code.code_hash = digest(convert_to(submitted_code, 'UTF8') || stored_code.salt, 'sha256') THEN
    UPDATE public.profiles
    SET is_authorized = TRUE, authorized_at = NOW(), updated_at = NOW()
    WHERE id = current_user_id;
    DELETE FROM public.account_authorization_codes WHERE user_id = current_user_id;
    RETURN TRUE;
  END IF;

  UPDATE public.account_authorization_codes
  SET attempts_remaining = attempts_remaining - 1
  WHERE user_id = current_user_id;
  RETURN FALSE;
END;
$$;

REVOKE ALL ON public.account_authorization_codes FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_account_authorization_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_account_authorization_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_account_authorization_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_account_authorization_code(TEXT) TO authenticated;
