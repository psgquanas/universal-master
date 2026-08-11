-- Add the profile fields needed by the updated onboarding flow
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure existing rows get a sensible updated timestamp
UPDATE public.profiles
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

-- Enforce unique usernames when provided
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key
  ON public.profiles (username)
  WHERE username IS NOT NULL;

-- Update the signup trigger so new users can carry a username if present
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, username)
  VALUES (
    NEW.id,
    NEW.phone,
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(NEW.raw_user_meta_data->>'username', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
