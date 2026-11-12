-- Use two real database sessions to reproduce overlapping first-time saves.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path = public, extensions;
select no_plan();
select dblink_connect(name, pg_catalog.format(
 'dbname=postgres user=postgres password=postgres host=%s port=%s',
 pg_catalog.host(pg_catalog.inet_server_addr()), pg_catalog.inet_server_port()
)) from (values ('paste_first'), ('paste_second'), ('paste_cleanup')) as sessions(name);

select dblink_exec(name, 'set role authenticated'),
 dblink_exec(name, $$set request.jwt.claims =
 '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}'$$),
 dblink_exec(name, $$set lock_timeout = '5s'$$)
from (values ('paste_first'), ('paste_second')) as sessions(name);

select dblink_exec('paste_first', 'begin');
create temporary table first_paste as
 select id from dblink('paste_first', $$
 select id from public.find_or_create_pasted_source('Synthetic concurrent paste issue 82.')
 $$) as t(id uuid);
select is((select count(*) from first_paste), 1::bigint, 'first save returns a source');

select dblink_send_query('paste_second', $$
 select id from public.find_or_create_pasted_source('Synthetic concurrent paste issue 82.')
$$);
select pg_sleep(0.5);
select is(dblink_is_busy('paste_second'), 1, 'overlapping save waits for the first transaction');
select dblink_exec('paste_first', 'commit');
select is(
 (select id from dblink_get_result('paste_second') as t(id uuid)),
 (select id from first_paste),
 'both concurrent submissions return the same source ID'
);
select * from dblink_get_result('paste_second') as t(id uuid);
select is((select n from dblink('paste_cleanup', $$
 select count(*) from public.sources
 where owner_id = '11111111-1111-4111-8111-111111111111'
 and url is null and text = 'Synthetic concurrent paste issue 82.'
$$) as t(n bigint)), 1::bigint, 'concurrent saves create exactly one source');

select dblink_exec('paste_cleanup', $$
 delete from public.sources
 where owner_id = '11111111-1111-4111-8111-111111111111'
 and url is null and text = 'Synthetic concurrent paste issue 82.'
$$);
select dblink_disconnect(name)
from (values ('paste_first'), ('paste_second'), ('paste_cleanup')) as sessions(name);
select * from finish();
rollback;
