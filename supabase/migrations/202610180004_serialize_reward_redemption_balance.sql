-- Serialize redemption balance checks for each account to prevent concurrent overspending.
create or replace function public.request_reward_redemption(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := (select auth.uid()); v_reward public.rewards%rowtype; v_balance bigint; v_redemption uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform 1 from public.profiles p where p.id=v_user for update;
  if not found then raise exception 'Account profile not found. Sign out and back in, then try again.' using errcode='P0002'; end if;
  select * into v_reward from public.rewards where id=p_reward_id and is_active=true for update;
  if not found then raise exception 'This reward is no longer available' using errcode='P0002'; end if;
  select coalesce(sum(amount),0) into v_balance from public.points_ledger where user_id=v_user;
  if v_balance < v_reward.points_cost then raise exception 'Not enough points for this reward' using errcode='22023'; end if;
  insert into public.redemptions(user_id,reward_id,points_cost,status) values(v_user,v_reward.id,v_reward.points_cost,'pending') returning id into v_redemption;
  insert into public.points_ledger(user_id,amount,reason,task_submission_id) values(v_user,-v_reward.points_cost,left('Reward redemption: '||v_reward.title,200),null);
  return jsonb_build_object('success',true,'redemption_id',v_redemption,'points_deducted',v_reward.points_cost);
end; $$;
revoke all on function public.request_reward_redemption(uuid) from public,anon,authenticated;
grant execute on function public.request_reward_redemption(uuid) to authenticated;
