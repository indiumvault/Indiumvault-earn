-- Keep the support UID lookup aligned with the shared administrator allowlist.
CREATE OR REPLACE FUNCTION public.admin_lookup_account_by_uid(p_support_uid text)
RETURNS TABLE(support_uid text, username text, email text, created_at timestamp with time zone, points_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.admin_users a
    WHERE a.user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Administrator access required' USING errcode = '42501';
  END IF;
  RETURN QUERY
    SELECT ap.support_uid::text, ap.username::text, u.email::text, ap.created_at,
      COALESCE((SELECT SUM(pl.amount)::bigint FROM public.points_ledger pl WHERE pl.user_id = ap.user_id), 0)::bigint
    FROM public.account_profiles ap
    JOIN auth.users u ON u.id = ap.user_id
    WHERE ap.support_uid = btrim(p_support_uid)
    LIMIT 1;
END;
$function$;
