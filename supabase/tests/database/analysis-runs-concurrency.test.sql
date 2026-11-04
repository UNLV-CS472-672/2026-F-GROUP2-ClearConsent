-- Two real sessions start a run for the same source at once, as two tabs would. The fixtures are
-- committed through a separate connection so both sessions can see them, and removed at the end.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- dblink needs password authentication, which the local stack requires on its network address
-- but not on loopback. pg_prove connects over that network, so connect back to the same address.
select dblink_connect(name, pg_catalog.format(
  'dbname=postgres user=postgres password=postgres host=%s port=%s',
  pg_catalog.host(pg_catalog.inet_server_addr()), pg_catalog.inet_server_port()
))
from (values ('setup'), ('first'), ('second')) as sessions (name);

select dblink_exec('setup', $$
  insert into public.sources (id, owner_id, text) values (
    '72000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'Concurrency policy.'
  )
$$);

select dblink_exec(name, 'set role authenticated'),
  dblink_exec(name, $$set request.jwt.claims =
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}'$$)
from (values ('first'), ('second')) as sessions (name);

-- The first session claims the run and keeps its transaction (and the source's lock) open.
select dblink_exec('first', 'begin');

select is(
  (select r->>'status' from dblink('first',
    $$select public.start_analysis_run('72000000-0000-4000-8000-000000000001')$$
  ) as t (r jsonb)),
  'started',
  'first session claims the run'
);

select dblink_send_query('second',
  $$select public.start_analysis_run('72000000-0000-4000-8000-000000000001', true)$$
);
select pg_sleep(0.5);

select is(dblink_is_busy('second'), 1, 'second session waits for the first to finish starting');

select dblink_exec('first', 'commit');

select is(
  (select r->>'status' from dblink_get_result('second') as t (r jsonb)),
  'running',
  'second session sees the first run instead of claiming another'
);
-- Consume the end of the asynchronous result.
select * from dblink_get_result('second') as t (r jsonb);

select is(
  (select n from dblink('setup', $$
    select count(*) from public.analysis_runs
    where source_id = '72000000-0000-4000-8000-000000000001'
  $$) as t (n bigint)),
  1::bigint,
  'only one run exists'
);

select dblink_exec('setup', $$
  delete from public.sources where id = '72000000-0000-4000-8000-000000000001'
$$);

select dblink_disconnect(name) from (values ('setup'), ('first'), ('second')) as sessions (name);

select * from finish();
rollback;
