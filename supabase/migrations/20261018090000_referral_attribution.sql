-- Record referral attribution at account creation; no referral rewards are issued.
create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now(),
  constraint referral_attributions_no_self_referral check (referrer_user_id <> referred_user_id)
);
create index if not exists referral_attributions_referrer_idx on public.referral_attributions(referrer_user_id);
alter table public.referral_attributions enable row level security;
create or replace function public.capture_signup_referral()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_code text; v_referrer uuid;
begin
  v_code := upper(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if v_code = '' or v_code !~ '^[A-F0-9]{10}$' then return new; end if;
  select ap.user_id into v_referrer from public.account_profiles ap where ap.referral_code = v_code limit 1;
  if v_referrer is null or v_referrer = new.id then return new; end if;
  insert into public.referral_attributions(referrer_user_id, referred_user_id, referral_code)
  values (v_referrer, new.id, v_code) on conflict (referred_user_id) do nothing;
  return new;
end; $$;
drop trigger if exists capture_signup_referral on auth.users;
create trigger capture_signup_referral after insert on auth.users for each row execute function public.capture_signup_referral();
create or replace function public.my_referral_count()
returns bigint language sql stable security definer set search_path = '' as $$
  select count(*)::bigint from public.referral_attributions ra where ra.referrer_user_id = (select auth.uid());
$$;
revoke all on function public.my_referral_count() from public, anon;
grant execute on function public.my_referral_count() to authenticated;
revoke all on function public.capture_signup_referral() from public, anon, authenticated;
comment on table public.referral_attributions is 'Signup attribution only. Referral points and cash rewards are not automatically issued.';
