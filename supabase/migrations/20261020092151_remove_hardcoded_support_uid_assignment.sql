-- Every new account receives a generated, unique support UID; never special-case an account UUID.
CREATE OR REPLACE FUNCTION public.create_account_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_uid text;
BEGIN
  new_uid := public.generate_support_uid();
  INSERT INTO public.account_profiles(user_id, username, support_uid)
  VALUES (
    NEW.id,
    NULLIF(btrim(coalesce(NEW.raw_user_meta_data ->> 'username', '')), ''),
    new_uid
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
