-- Allow a user to retry a task after a rejected submission.
-- The partial unique index added in 20261020100000 protects pending/approved submissions.
-- Remove the older table-wide unique constraint, which otherwise blocks all retries.
alter table public.task_submissions
  drop constraint if exists task_submissions_user_id_task_id_key;
