-- One pending request per user/reward prevents duplicate pending deductions.
create unique index if not exists redemptions_one_pending_per_user_reward
on public.redemptions(user_id,reward_id)
where status='pending';
