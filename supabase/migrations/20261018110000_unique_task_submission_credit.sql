-- A task submission may generate at most one ledger entry.
-- The review RPC already locks pending submissions; this constraint adds a database-level safeguard.
create unique index if not exists points_ledger_one_entry_per_submission
  on public.points_ledger(task_submission_id)
  where task_submission_id is not null;
