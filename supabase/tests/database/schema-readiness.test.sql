begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

set local role anon;
select is(public.analysis_schema_ready_v1(), true, 'anon can read the complete schema contract');
reset role;

select ok(not p.prosecdef and p.provolatile = 's', 'probe is stable security invoker')
from pg_proc p where p.oid = 'public.analysis_schema_ready_v1()'::regprocedure;

alter table public.analysis_runs rename to readiness_hidden_runs;
set local role anon;
select is(public.analysis_schema_ready_v1(), false, 'missing table fails closed');
reset role;
alter table public.readiness_hidden_runs rename to analysis_runs;

alter table public.analysis_runs disable row level security;
select is(public.analysis_schema_ready_v1(), false, 'disabled RLS fails closed');
alter table public.analysis_runs enable row level security;

alter table public.analysis_runs rename column expires_at to readiness_hidden_expiry;
select is(public.analysis_schema_ready_v1(), false, 'missing required column fails closed');
alter table public.analysis_runs rename column readiness_hidden_expiry to expires_at;

alter function public.start_analysis_run(uuid, boolean) rename to readiness_hidden_start;
select is(public.analysis_schema_ready_v1(), false, 'missing start signature fails closed');
alter function public.readiness_hidden_start(uuid, boolean) rename to start_analysis_run;

alter function public.fail_analysis_run(uuid, uuid, text, text) rename to readiness_hidden_fail;
select is(public.analysis_schema_ready_v1(), false, 'missing fail signature fails closed');
alter function public.readiness_hidden_fail(uuid, uuid, text, text) rename to fail_analysis_run;

alter function public.release_analysis_run(uuid, uuid) rename to readiness_hidden_release;
create function public.release_analysis_run(text, text) returns boolean language sql as 'select true';
revoke all on function public.release_analysis_run(text, text) from public;
grant execute on function public.release_analysis_run(text, text) to authenticated;
select is(public.analysis_schema_ready_v1(), false, 'wrong parameter types do not satisfy the signature');
drop function public.release_analysis_run(text, text);
create function public.release_analysis_run(wrong_name uuid, p_run_id uuid) returns boolean language sql as 'select true';
revoke all on function public.release_analysis_run(uuid, uuid) from public;
grant execute on function public.release_analysis_run(uuid, uuid) to authenticated;
select is(public.analysis_schema_ready_v1(), false, 'wrong named parameters fail closed');
drop function public.release_analysis_run(uuid, uuid);
create function public.release_analysis_run(p_source_id uuid, p_run_id uuid) returns text language sql as $$select 'true'::text$$;
revoke all on function public.release_analysis_run(uuid, uuid) from public;
grant execute on function public.release_analysis_run(uuid, uuid) to authenticated;
select is(public.analysis_schema_ready_v1(), false, 'wrong return type fails closed');
drop function public.release_analysis_run(uuid, uuid);
alter function public.readiness_hidden_release(uuid, uuid) rename to release_analysis_run;

revoke execute on function public.release_analysis_run(uuid, uuid) from authenticated;
select is(public.analysis_schema_ready_v1(), false, 'missing authenticated execute fails closed');
grant execute on function public.release_analysis_run(uuid, uuid) to authenticated;
grant execute on function public.release_analysis_run(uuid, uuid) to anon;
select is(public.analysis_schema_ready_v1(), false, 'unexpected anonymous execute fails closed');
revoke execute on function public.release_analysis_run(uuid, uuid) from anon;

set local role anon;
select is(public.analysis_schema_ready_v1(), true, 'restored contract passes without reading user rows');
reset role;
select * from finish();
rollback;
