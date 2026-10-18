-- Index the reward foreign key to keep joins and reward deletion checks efficient.
create index if not exists redemptions_reward_id_idx on public.redemptions(reward_id);
