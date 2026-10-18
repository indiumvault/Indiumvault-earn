-- IndiumVault Earn account usernames and numeric support UIDs.
-- Apply ONLY to Supabase project hprbcntedjrdowreqmak.
-- UID is a support identifier, never an authentication credential.

create table if not exists public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  support_uid text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_profiles_username_format check (
    username is null or (char_length(username) between 2 and 24 and username ~ '^[A-Za-z0-9_.-]+$')
  )
);

create unique index if not exists account_profiles_username_lower_unique
  on public.account_profiles (lower(username))
  where username is not null;

alter table public.account_profiles enable row level security;

drop policy if exists account_profiles_select_own on public.account_profiles;
create policy account_profiles_select_own on public.account_profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists account_profiles_update_own on public.account_profiles;
create policy account_profiles_update_own on public.account_profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.account_profiles from anon, authenticated;
grant select on public.account_profiles to authenticated;
grant update (username, updated_at) on public.account_profiles to authenticated;

create or replace function public.generate_support_uid()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  occupied bigint;
  attempts integer := 0;
begin
  select count(*) into occupied
  from public.account_profiles
  where length(support_uid) = 6;

  if occupied >= 900000 then
    loop
      candidate := (1000000 + floor(random() * 9000000)::bigint)::text;
      exit when not exists (
        select 1 from public.account_profiles where support_uid = candidate
      );
    end loop;
    return candidate;
  end if;

  loop
    candidate := (100000 + floor(random() * 900000)::bigint)::text;
    exit when not exists (
      select 1 from public.account_profiles where support_uid = candidate
    );
    attempts := attempts + 1;
    if attempts >= 10000 then
      -- Extremely unlikely under normal usage; still avoid collisions.
      candidate := (1000000 + floor(random() * 9000000)::bigint)::text;
      if not exists (select 1 from public.account_profiles where support_uid = candidate) then
        return candidate;
      end if;
      attempts := 0;
    end if;
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_account_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_uid text;
begin
  if new.id = '8205d1e2-ffa9-4a26-8708-b625d96ec7b4'::uuid then
    new_uid := '55555';
  else
    new_uid := public.generate_support_uid();
  end if;

  insert into public.account_profiles(user_id, username, support_uid)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')), ''),
    new_uid
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_account_profile on auth.users;
create trigger on_auth_user_created_account_profile
  after insert on auth.users
  for each row execute function public.create_account_profile();

-- Backfill existing accounts without changing their auth UUID or history.
do $$
declare
  u record;
  new_uid text;
begin
  for u in select id, raw_user_meta_data from auth.users
           where id not in (select user_id from public.account_profiles)
  loop
    if u.id = '8205d1e2-ffa9-4a26-8708-b625d96ec7b4'::uuid then
      new_uid := '55555';
    else
      new_uid := public.generate_support_uid();
    end if;

    insert into public.account_profiles(user_id, username, support_uid)
    values (
      u.id,
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'username', '')), ''),
      new_uid
    )
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.set_my_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_username text := btrim(coalesce(p_username, ''));
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(v_username) < 2 or char_length(v_username) > 24
     or v_username !~ '^[A-Za-z0-9_.-]+$' then
    raise exception 'Username must be 2–24 characters using letters, numbers, dots, underscores, or hyphens'
      using errcode = '22023';
  end if;

  update public.account_profiles
  set username = v_username, updated_at = now()
  where user_id = v_user;

  if not found then
    raise exception 'Account profile not found; sign out and sign in again' using errcode = 'P0002';
  end if;
  return v_username;
exception
  when unique_violation then
    raise exception 'That username is already taken' using errcode = '23505';
end;
$$;

revoke all on function public.generate_support_uid() from public, anon, authenticated;
revoke all on function public.create_account_profile() from public, anon, authenticated;
revoke all on function public.set_my_username(text) from public, anon;
grant execute on function public.set_my_username(text) to authenticated;

comment on table public.account_profiles is 'IndiumVault Earn public-facing username and support UID. Auth UUID remains the canonical account identity.';
comment on column public.account_profiles.support_uid is 'Unique numeric support reference; never use as an authentication secret.';
