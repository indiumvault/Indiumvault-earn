-- Prevent a user from having multiple active or approved submissions for the same task.
-- Rejected submissions may be retried; pending and approved submissions block repeats.
-- Existing data was checked before adding this index.
create unique index if not exists task_submissions_one_pending_or_approved_per_user_task
  on public.task_submissions(user_id, task_id)
  where status in ('pending', 'approved');
