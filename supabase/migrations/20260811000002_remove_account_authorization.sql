DROP FUNCTION IF EXISTS public.verify_account_authorization_code(TEXT);
DROP FUNCTION IF EXISTS public.issue_account_authorization_code();
DROP TABLE IF EXISTS public.account_authorization_codes;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_authorized,
  DROP COLUMN IF EXISTS authorized_at;
