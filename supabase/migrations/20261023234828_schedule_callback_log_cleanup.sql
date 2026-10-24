-- Enable the scheduler (Supabase keeps extensions in the "extensions" schema)
create extension if not exists pg_cron with schema extensions;

-- Run every day at 03:00 UTC and delete rows older than 90 days. (Privacy policy)
-- Scheduling with an existing job name updates that job, so re-running the migration is safe.
select cron.schedule(
  'delete-old-callback-logs',
  '0 3 * * *',
  $$ delete from public.callback_logs where created_at < now() - interval '90 days' $$
);