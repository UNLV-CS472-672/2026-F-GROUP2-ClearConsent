begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Synthetic sources for the two existing seed users.
insert into public.sources (id, owner_id, title, text) values
(
  '71000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Synthetic policy',
  'We share location with advertisers.'
),
(
  '71000000-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  'Already analyzed policy',
  'We share location with advertisers.'
),
(
  '71000000-0000-4000-8000-000000000003',
  '22222222-2222-4222-8222-222222222222',
  'Other user policy',
  'We share location with advertisers.'
);

insert into public.analyses (
  id, owner_id, source_id, source_type, source_text, summary, outcome
) values (
  '81000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  '71000000-0000-4000-8000-000000000002',
  'pasted_text',
  'We share location with advertisers.',
  'Location is shared with advertisers.',
  'no_findings'
);

create table pg_temp.runs (name text primary key, run_id uuid);
grant all on pg_temp.runs to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- First start claims the run.
insert into pg_temp.runs
select 'first', (r->>'runId')::uuid
from public.start_analysis_run('71000000-0000-4000-8000-000000000001') as r
where r->>'status' = 'started';

select is((select count(*) from pg_temp.runs)::bigint, 1::bigint, 'first start claims a run');

select is(
  (select status::text from public.analysis_runs
   where source_id = '71000000-0000-4000-8000-000000000001'),
  'running',
  'owner reads the running state'
);

-- A refresh or second tab while running gets the existing run, with no run id to finish it.
select is(
  public.start_analysis_run('71000000-0000-4000-8000-000000000001'),
  '{"status":"running","runId":null}'::jsonb,
  'second start while running does not claim another run'
);

select is(
  public.start_analysis_run('71000000-0000-4000-8000-000000000001', true),
  '{"status":"running","runId":null}'::jsonb,
  'retry while running does not claim another run'
);

-- Only the holder of the run id can finish it.
select is(
  public.fail_analysis_run(
    '71000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000000',
    'provider_timeout',
    'The analysis provider timed out.'
  ),
  false,
  'a wrong run id cannot fail the run'
);

select is(
  public.fail_analysis_run(
    '71000000-0000-4000-8000-000000000001',
    (select run_id from pg_temp.runs where name = 'first'),
    'provider_timeout',
    'The analysis provider timed out.'
  ),
  true,
  'the run holder records a failure'
);

select results_eq(
  $$select status::text, error_code, error_message from public.analysis_runs
    where source_id = '71000000-0000-4000-8000-000000000001'$$,
  $$values ('failed', 'provider_timeout', 'The analysis provider timed out.')$$,
  'failure is stored with its code and message'
);

-- Revisiting a failed source does not start a run.
select is(
  public.start_analysis_run('71000000-0000-4000-8000-000000000001'),
  '{"status":"failed","runId":null}'::jsonb,
  'start without retry does not re-run a failed source'
);

-- Try again starts exactly one new run.
insert into pg_temp.runs
select 'retry', (r->>'runId')::uuid
from public.start_analysis_run('71000000-0000-4000-8000-000000000001', true) as r
where r->>'status' = 'started';

select isnt(
  (select run_id from pg_temp.runs where name = 'retry'),
  (select run_id from pg_temp.runs where name = 'first'),
  'retry claims a new run id'
);

select results_eq(
  $$select status::text, error_code, finished_at from public.analysis_runs
    where source_id = '71000000-0000-4000-8000-000000000001'$$,
  $$values ('running', null::text, null::timestamptz)$$,
  'retry clears the stored failure'
);

select is(
  public.start_analysis_run('71000000-0000-4000-8000-000000000001', true),
  '{"status":"running","runId":null}'::jsonb,
  'a second retry while the retry runs does not claim another run'
);

-- A late result from the first run cannot touch the retry.
select is(
  public.complete_analysis_run(
    '71000000-0000-4000-8000-000000000001',
    (select run_id from pg_temp.runs where name = 'first')
  ),
  false,
  'an old run id cannot complete the current run'
);

select is(
  public.complete_analysis_run(
    '71000000-0000-4000-8000-000000000001',
    (select run_id from pg_temp.runs where name = 'retry')
  ),
  true,
  'the current run holder completes the run'
);

select is(
  (select count(*) from public.analysis_runs
   where source_id = '71000000-0000-4000-8000-000000000001')::bigint,
  0::bigint,
  'completing a run removes its state'
);

-- A source with a saved analysis never starts a run, even on retry.
select is(
  public.start_analysis_run('71000000-0000-4000-8000-000000000002', true),
  '{"status":"complete","runId":null}'::jsonb,
  'an analyzed source does not start a run'
);

-- Direct writes and the run id are not available to clients.
select throws_ok(
  $test$select run_id from public.analysis_runs$test$,
  '42501', null, 'run id is not readable'
);

select throws_ok(
  $test$insert into public.analysis_runs (source_id, owner_id, status, run_id, expires_at)
    values ('71000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
      'running', gen_random_uuid(), now())$test$,
  '42501', null, 'clients cannot insert runs directly'
);

select throws_ok(
  $test$delete from public.analysis_runs$test$,
  '42501', null, 'clients cannot delete runs directly'
);

-- Another user's source cannot be started.
select throws_ok(
  $test$select public.start_analysis_run('71000000-0000-4000-8000-000000000003')$test$,
  '42501', null, 'cannot start a run for another user''s source'
);

-- An expired run counts as failed: it needs an explicit retry.
insert into pg_temp.runs
select 'expiring', (r->>'runId')::uuid
from public.start_analysis_run('71000000-0000-4000-8000-000000000001') as r
where r->>'status' = 'started';

reset role;
update public.analysis_runs
set started_at = now() - interval '1 hour', expires_at = now() - interval '45 minutes'
where source_id = '71000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  public.start_analysis_run('71000000-0000-4000-8000-000000000001'),
  '{"status":"failed","runId":null}'::jsonb,
  'an expired run is not restarted without retry'
);

select is(
  public.start_analysis_run('71000000-0000-4000-8000-000000000001', true)->>'status',
  'started',
  'an expired run can be retried'
);

select is(
  public.fail_analysis_run(
    '71000000-0000-4000-8000-000000000001',
    (select run_id from pg_temp.runs where name = 'expiring'),
    'provider_timeout',
    'The analysis provider timed out.'
  ),
  false,
  'the expired run cannot fail the retry that replaced it'
);

-- The second user sees none of the first user's runs.
set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.analysis_runs)::bigint,
  0::bigint,
  'second user is isolated from analysis_runs'
);

select is(
  public.fail_analysis_run(
    '71000000-0000-4000-8000-000000000001',
    (select run_id from pg_temp.runs where name = 'expiring'),
    'provider_timeout',
    'The analysis provider timed out.'
  ),
  false,
  'second user cannot fail the first user''s run'
);

reset role;
set local role anon;

select throws_ok(
  $test$select * from public.analysis_runs$test$,
  '42501', null, 'anonymous denied analysis_runs'
);

select throws_ok(
  $test$select public.start_analysis_run('71000000-0000-4000-8000-000000000001')$test$,
  '42501', null, 'anonymous cannot start a run'
);

-- Deleting a source removes its run state.
reset role;
delete from public.sources where id = '71000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.analysis_runs
   where source_id = '71000000-0000-4000-8000-000000000001')::bigint,
  0::bigint,
  'source deletion cascades to its run'
);

select * from finish();
rollback;
