-- Admin-only support lookup by numeric account UID.
create or replace function public.admin_lookup_account_by_uid(p_support_uid text)
returns table(support_uid text, username text, email text, created_at timestamptz, points_balance bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is distinct from '8205d1e2-ffa9-4a26-8708-b625d96ec7b4'::uuid then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
    select ap.support_uid, ap.username, u.email, ap.created_at,
      coalesce((select sum(pl.amount)::bigint from public.points_ledger pl where pl.user_id = ap.user_id), 0)::bigint
    from public.account_profiles ap
    join auth.users u on u.id = ap.user_id
    where ap.support_uid = btrim(p_support_uid)
    limit 1;
end;
$$;
revoke all on function public.admin_lookup_account_by_uid(text) from public, anon;
grant execute on function public.admin_lookup_account_by_uid(text) to authenticated;
comment on function public.admin_lookup_account_by_uid(text) is 'Admin-only support lookup by numeric UID. Returns minimal account identity and points balance.';
