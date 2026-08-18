-- Allow an authenticated user to permanently delete their own account.
-- Profiles and related app data are removed through existing ON DELETE CASCADE keys.
CREATE OR REPLACE FUNCTION public.delete_current_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  DELETE FROM auth.users WHERE id = current_user_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_current_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_current_account() TO authenticated;
