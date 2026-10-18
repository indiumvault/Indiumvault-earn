-- Admin task/reward management and atomic reward-redemption workflows.
-- Apply only to the Indiumvault-earn project (hprbcntedjrdowreqmak).

create or replace function public.admin_list_tasks()
returns table(task_id uuid,title text,description text,category text,points integer,destination_url text,is_active boolean,created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from private.admin_users a where a.user_id=(select auth.uid())) then raise exception 'Administrator access required' using errcode='42501'; end if;
  return query select t.id,t.title,t.description,t.category,t.points,t.destination_url,t.is_active,t.created_at from public.tasks t order by t.created_at desc;
end; $$;

create or replace function public.admin_save_task(p_task_id uuid,p_title text,p_description text,p_category text,p_points integer,p_destination_url text,p_is_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from private.admin_users a where a.user_id=(select auth.uid())) then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 3 and 100 then raise exception 'Task title must be 3–100 characters' using errcode='22023'; end if;
  if p_description is null or char_length(p_description)>2000 then raise exception 'Task instructions must be 2,000 characters or fewer' using errcode='22023'; end if;
  if p_category is null or char_length(btrim(p_category)) not between 2 and 40 then raise exception 'Category must be 2–40 characters' using errcode='22023'; end if;
  if p_points is null or p_points < 0 or p_points > 100000 then raise exception 'Points must be between 0 and 100,000' using errcode='22023'; end if;
  if p_destination_url is not null and btrim(p_destination_url) <> '' and p_destination_url !~* '^https?://' then raise exception 'Task link must start with http:// or https://' using errcode='22023'; end if;
  if p_task_id is null then
    insert into public.tasks(title,description,category,points,destination_url,is_active)
    values(btrim(p_title),btrim(p_description),btrim(p_category),p_points,nullif(btrim(coalesce(p_destination_url,'')),''),coalesce(p_is_active,false)) returning id into v_id;
  else
    update public.tasks set title=btrim(p_title),description=btrim(p_description),category=btrim(p_category),points=p_points,destination_url=nullif(btrim(coalesce(p_destination_url,'')),''),is_active=coalesce(p_is_active,false)
    where id=p_task_id returning id into v_id;
    if v_id is null then raise exception 'Task not found' using errcode='P0002'; end if;
  end if;
  return v_id;
end; $$;

create or replace function public.admin_list_rewards()
returns table(reward_id uuid,title text,description text,points_cost integer,reward_type text,is_active boolean,created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from private.admin_users a where a.user_id=(select auth.uid())) then raise exception 'Administrator access required' using errcode='42501'; end if;
  return query select r.id,r.title,r.description,r.points_cost,r.reward_type,r.is_active,r.created_at from public.rewards r order by r.created_at desc;
end; $$;

create or replace function public.admin_save_reward(p_reward_id uuid,p_title text,p_description text,p_points_cost integer,p_reward_type text,p_is_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from private.admin_users a where a.user_id=(select auth.uid())) then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 2 and 100 then raise exception 'Reward title must be 2–100 characters' using errcode='22023'; end if;
  if p_description is null or char_length(p_description)>2000 then raise exception 'Reward description must be 2,000 characters or fewer' using errcode='22023'; end if;
  if p_points_cost is null or p_points_cost <= 0 or p_points_cost > 10000000 then raise exception 'Reward cost must be between 1 and 10,000,000 points' using errcode='22023'; end if;
  if p_reward_type is null or p_reward_type not in ('demo','gift_card','other') then raise exception 'Choose a valid reward type' using errcode='22023'; end if;
  if p_reward_id is null then
    insert into public.rewards(title,description,points_cost,reward_type,is_active) values(btrim(p_title),btrim(p_description),p_points_cost,p_reward_type,coalesce(p_is_active,false)) returning id into v_id;
  else
    update public.rewards set title=btrim(p_title),description=btrim(p_description),points_cost=p_points_cost,reward_type=p_reward_type,is_active=coalesce(p_is_active,false) where id=p_reward_id returning id into v_id;
    if v_id is null then raise exception 'Reward not found' using errcode='P0002'; end if;
  end if;
  return v_id;
end; $$;

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

create or replace function public.admin_list_redemptions()
returns table(redemption_id uuid,user_id uuid,user_email text,reward_id uuid,reward_title text,points_cost integer,status text,created_at timestamptz,reviewed_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from private.admin_users a where a.user_id=(select auth.uid())) then raise exception 'Administrator access required' using errcode='42501'; end if;
  return query select d.id,d.user_id,u.email::text,d.reward_id,r.title,d.points_cost,d.status,d.created_at,d.reviewed_at from public.redemptions d join auth.users u on u.id=d.user_id join public.rewards r on r.id=d.reward_id order by case d.status when 'pending' then 0 when 'approved' then 1 else 2 end,d.created_at asc;
end; $$;

create or replace function public.admin_review_redemption(p_redemption_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_redemption public.redemptions%rowtype; v_reward public.rewards%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from private.admin_users a where a.user_id=(select auth.uid())) then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('approved','rejected','fulfilled') then raise exception 'Decision must be approved, rejected, or fulfilled' using errcode='22023'; end if;
  select * into v_redemption from public.redemptions where id=p_redemption_id for update;
  if not found then raise exception 'Redemption not found' using errcode='P0002'; end if;
  if p_decision='approved' then
    if v_redemption.status<>'pending' then raise exception 'Only pending redemptions can be approved' using errcode='55000'; end if;
    update public.redemptions set status='approved',reviewed_at=now() where id=p_redemption_id;
  elsif p_decision='rejected' then
    if v_redemption.status<>'pending' then raise exception 'Only pending redemptions can be rejected' using errcode='55000'; end if;
    select * into v_reward from public.rewards where id=v_redemption.reward_id;
    update public.redemptions set status='rejected',reviewed_at=now() where id=p_redemption_id;
    insert into public.points_ledger(user_id,amount,reason,task_submission_id) values(v_redemption.user_id,v_redemption.points_cost,left('Refund: rejected reward redemption - '||coalesce(v_reward.title,'reward'),200),null);
  else
    if v_redemption.status<>'approved' then raise exception 'Only approved redemptions can be marked fulfilled' using errcode='55000'; end if;
    update public.redemptions set status='fulfilled',reviewed_at=now() where id=p_redemption_id;
  end if;
  return jsonb_build_object('success',true,'status',p_decision,'refunded',p_decision='rejected');
end; $$;

revoke all on function public.admin_list_tasks() from public,anon,authenticated;
revoke all on function public.admin_save_task(uuid,text,text,text,integer,text,boolean) from public,anon,authenticated;
revoke all on function public.admin_list_rewards() from public,anon,authenticated;
revoke all on function public.admin_save_reward(uuid,text,text,integer,text,boolean) from public,anon,authenticated;
revoke all on function public.request_reward_redemption(uuid) from public,anon,authenticated;
revoke all on function public.admin_list_redemptions() from public,anon,authenticated;
revoke all on function public.admin_review_redemption(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_list_tasks() to authenticated;
grant execute on function public.admin_save_task(uuid,text,text,text,integer,text,boolean) to authenticated;
grant execute on function public.admin_list_rewards() to authenticated;
grant execute on function public.admin_save_reward(uuid,text,text,integer,text,boolean) to authenticated;
grant execute on function public.request_reward_redemption(uuid) to authenticated;
grant execute on function public.admin_list_redemptions() to authenticated;
grant execute on function public.admin_review_redemption(uuid,text) to authenticated;
