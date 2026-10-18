-- Improve input validation and provide a safe, user-scoped redemption history endpoint.
create or replace function public.admin_save_task(p_task_id uuid,p_title text,p_description text,p_category text,p_points integer,p_destination_url text,p_is_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from private.admin_users a where a.user_id=(select auth.uid())) then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 3 and 100 then raise exception 'Task title must be 3–100 characters' using errcode='22023'; end if;
  if p_description is null or char_length(btrim(p_description))=0 or char_length(p_description)>2000 then raise exception 'Task instructions must be non-empty and no more than 2,000 characters' using errcode='22023'; end if;
  if p_category is null or char_length(btrim(p_category)) not between 2 and 40 then raise exception 'Category must be 2–40 characters' using errcode='22023'; end if;
  if p_points is null or p_points < 0 or p_points > 100000 then raise exception 'Points must be between 0 and 100,000' using errcode='22023'; end if;
  if p_destination_url is not null and btrim(p_destination_url) <> '' and p_destination_url !~* '^https?://' then raise exception 'Task link must start with http:// or https://' using errcode='22023'; end if;
  if p_task_id is null then
    insert into public.tasks(title,description,category,points,destination_url,is_active) values(btrim(p_title),btrim(p_description),btrim(p_category),p_points,nullif(btrim(coalesce(p_destination_url,'')),''),coalesce(p_is_active,false)) returning id into v_id;
  else
    update public.tasks set title=btrim(p_title),description=btrim(p_description),category=btrim(p_category),points=p_points,destination_url=nullif(btrim(coalesce(p_destination_url,'')),''),is_active=coalesce(p_is_active,false) where id=p_task_id returning id into v_id;
    if v_id is null then raise exception 'Task not found' using errcode='P0002'; end if;
  end if;
  return v_id;
end; $$;

create or replace function public.admin_save_reward(p_reward_id uuid,p_title text,p_description text,p_points_cost integer,p_reward_type text,p_is_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from private.admin_users a where a.user_id=(select auth.uid())) then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 2 and 100 then raise exception 'Reward title must be 2–100 characters' using errcode='22023'; end if;
  if p_description is null or char_length(btrim(p_description))=0 or char_length(p_description)>2000 then raise exception 'Reward description must be non-empty and no more than 2,000 characters' using errcode='22023'; end if;
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
revoke all on function public.admin_save_task(uuid,text,text,text,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_save_task(uuid,text,text,text,integer,text,boolean) to authenticated;
revoke all on function public.admin_save_reward(uuid,text,text,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_save_reward(uuid,text,text,integer,text,boolean) to authenticated;

create or replace function public.user_list_redemptions()
returns table(redemption_id uuid,reward_id uuid,reward_title text,points_cost integer,status text,created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  return query select d.id,d.reward_id,r.title,d.points_cost,d.status,d.created_at
  from public.redemptions d join public.rewards r on r.id=d.reward_id
  where d.user_id=v_user order by d.created_at desc limit 20;
end; $$;
revoke all on function public.user_list_redemptions() from public,anon,authenticated;
grant execute on function public.user_list_redemptions() to authenticated;
