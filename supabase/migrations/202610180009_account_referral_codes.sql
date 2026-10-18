-- Referral code support for IndiumVault Earn account profiles.
-- Referral attribution/rewards are deliberately not enabled by this migration.
alter table public.account_profiles add column if not exists referral_code text;
update public.account_profiles set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)) where referral_code is null;
alter table public.account_profiles alter column referral_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
alter table public.account_profiles alter column referral_code set not null;
create unique index if not exists account_profiles_referral_code_unique on public.account_profiles (referral_code);
comment on column public.account_profiles.referral_code is 'Stable share code for referral attribution. Referral rewards remain disabled until anti-abuse checks are implemented.';
