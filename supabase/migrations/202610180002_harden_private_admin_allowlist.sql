-- Defense-in-depth follow-up for secure task review.
alter table private.admin_users enable row level security;

create or replace function public.admin_review_submission(p_submission_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_submission public.task_submissions%rowtype;
  v_task public.tasks%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (select 1 from private.admin_users a where a.user_id = (select auth.uid())) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  select * into v_submission from public.task_submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if v_submission.status <> 'pending' then
    raise exception 'This submission has already been reviewed' using errcode = '55000';
  end if;
  select * into v_task from public.tasks where id = v_submission.task_id;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;
  update public.task_submissions set status = p_decision, reviewed_at = now() where id = p_submission_id;
  if p_decision = 'approved' and v_task.points > 0 then
    insert into public.points_ledger(user_id, amount, reason, task_submission_id)
    values (v_submission.user_id, v_task.points, left('Approved task: ' || v_task.title, 200), v_submission.id);
  end if;
  return jsonb_build_object('success', true, 'decision', p_decision,
    'points_awarded', case when p_decision = 'approved' then v_task.points else 0 end);
end;
$$;
revoke all on function public.admin_review_submission(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_review_submission(uuid, text) to authenticated;
