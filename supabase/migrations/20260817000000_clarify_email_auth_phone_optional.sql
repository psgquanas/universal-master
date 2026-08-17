-- Migration: clarify_email_auth_phone_optional
--
-- Context: The app uses email+password authentication with email OTP verification.
-- Phone is collected at sign-up as optional user metadata and stored in profiles.phone,
-- but it is NOT used as an auth identifier and is NOT verified at sign-up time.
-- Users can later verify/change their phone via the email-OTP-gated change flow
-- (see change_phone_after_email_verification RPC).
--
-- The original schema had phone UNIQUE NOT NULL (designed for phone-auth).
-- The NOT NULL was dropped in 20260801000000. Here we replace the implicit
-- table-level UNIQUE constraint with a partial unique index that only enforces
-- uniqueness when a phone is actually provided (NULL values are excluded).

-- Drop the old implicit unique constraint on phone (created by UNIQUE keyword in CREATE TABLE).
-- Must drop the constraint, not the index directly, since the index backs a named constraint.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

-- Re-add uniqueness only for rows where phone is actually supplied.
-- This prevents two accounts claiming the same phone number while allowing
-- multiple accounts with no phone number at all.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_when_provided
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- Ensure the handle_new_user trigger is up to date with email-auth semantics.
-- Phone comes from user metadata (raw_user_meta_data), not from auth.users.phone.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name, gender, username)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'gender', ''),
    NULLIF(NEW.raw_user_meta_data->>'username', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    phone      = COALESCE(EXCLUDED.phone, public.profiles.phone),
    full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    gender     = COALESCE(EXCLUDED.gender, public.profiles.gender),
    username   = COALESCE(EXCLUDED.username, public.profiles.username),
    updated_at = NOW();
  RETURN NEW;
END;
$$;
