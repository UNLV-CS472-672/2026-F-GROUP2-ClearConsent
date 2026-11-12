begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

-- Catalog-only fixture: never execute the pasted-source RPC or inspect user rows.
-- Works before or after #94 lands; every change is rolled back.
drop function if exists public.find_or_create_pasted_source(text, text);
drop index if exists public.sources_paste_digest_idx;
set local role anon;
select is(public.analysis_schema_ready_v1(), true, 'legacy guard alone misses the absent paste contract');
select is(public.analysis_schema_ready_v2(), false, 'v2 blocks the pre-paste schema');
reset role;

create function public.find_or_create_pasted_source(p_text text, p_title text default null)
returns setof public.sources language sql security invoker set search_path = ''
as 'select null::public.sources where false';
revoke all on function public.find_or_create_pasted_source(text, text) from public, anon;
grant execute on function public.find_or_create_pasted_source(text, text) to authenticated;
select is(public.analysis_schema_ready_v2(), false, 'RPC without digest index is not ready');
create index sources_paste_digest_idx on public.sources (owner_id, md5(text)) where url is null;
set local role anon;
select is(public.analysis_schema_ready_v2(), true, 'complete catalog contract passes for anon');
reset role;
select ok(not p.prosecdef and p.provolatile = 's', 'v2 is stable security invoker')
from pg_proc p where p.oid = 'public.analysis_schema_ready_v2()'::regprocedure;

alter function public.find_or_create_pasted_source(text, text) rename to readiness_hidden_paste;
select is(public.analysis_schema_ready_v2(), false, 'missing RPC fails closed');
create function public.find_or_create_pasted_source(p_text uuid, p_title text)
returns setof public.sources language sql as 'select null::public.sources where false';
select is(public.analysis_schema_ready_v2(), false, 'wrong argument types fail closed');
drop function public.find_or_create_pasted_source(uuid, text);
create function public.find_or_create_pasted_source(wrong_name text, p_title text)
returns setof public.sources language sql as 'select null::public.sources where false';
revoke all on function public.find_or_create_pasted_source(text, text) from public;
grant execute on function public.find_or_create_pasted_source(text, text) to authenticated;
select is(public.analysis_schema_ready_v2(), false, 'wrong argument names fail closed');
drop function public.find_or_create_pasted_source(text, text);
create function public.find_or_create_pasted_source(p_text text, p_title text)
returns public.sources language sql as 'select null::public.sources';
revoke all on function public.find_or_create_pasted_source(text, text) from public;
grant execute on function public.find_or_create_pasted_source(text, text) to authenticated;
select is(public.analysis_schema_ready_v2(), false, 'non-set result fails closed');
drop function public.find_or_create_pasted_source(text, text);
create function public.find_or_create_pasted_source(p_text text, p_title text)
returns setof text language sql as $$select 'wrong'::text$$;
revoke all on function public.find_or_create_pasted_source(text, text) from public;
grant execute on function public.find_or_create_pasted_source(text, text) to authenticated;
select is(public.analysis_schema_ready_v2(), false, 'wrong return type fails closed');
drop function public.find_or_create_pasted_source(text, text);
alter function public.readiness_hidden_paste(text, text) rename to find_or_create_pasted_source;

alter function public.find_or_create_pasted_source(text, text) security definer;
select is(public.analysis_schema_ready_v2(), false, 'unexpected definer privileges fail closed');
alter function public.find_or_create_pasted_source(text, text) security invoker;
revoke execute on function public.find_or_create_pasted_source(text, text) from authenticated;
select is(public.analysis_schema_ready_v2(), false, 'missing authenticated execute fails closed');
grant execute on function public.find_or_create_pasted_source(text, text) to authenticated;
grant execute on function public.find_or_create_pasted_source(text, text) to public;
select is(public.analysis_schema_ready_v2(), false, 'PUBLIC execute exposing RPC to anon fails closed');
revoke execute on function public.find_or_create_pasted_source(text, text) from public;

revoke select on public.sources from authenticated;
select is(public.analysis_schema_ready_v2(), false, 'missing source SELECT fails closed');
grant select on public.sources to authenticated;
revoke insert on public.sources from authenticated;
select is(public.analysis_schema_ready_v2(), false, 'missing source INSERT fails closed');
grant insert on public.sources to authenticated;

alter table public.sources disable row level security;
select is(public.analysis_schema_ready_v2(), false, 'sources without RLS fails closed');
alter table public.sources enable row level security;
alter table public.sources rename column title to readiness_hidden_title;
select is(public.analysis_schema_ready_v2(), false, 'missing source column fails closed');
alter table public.sources rename column readiness_hidden_title to title;

drop index public.sources_paste_digest_idx;
create index sources_paste_digest_idx on public.sources (owner_id, md5(text));
select is(public.analysis_schema_ready_v2(), false, 'same-named index without paste predicate fails closed');
drop index public.sources_paste_digest_idx;
create index sources_paste_digest_idx on public.sources (owner_id, title) where url is null;
select is(public.analysis_schema_ready_v2(), false, 'same-named index with wrong keys fails closed');
drop index public.sources_paste_digest_idx;
create index sources_paste_digest_idx on public.sources (owner_id, md5(text)) where url is null;

alter table public.analysis_runs disable row level security;
select is(public.analysis_schema_ready_v2(), false, 'v2 retains the analysis-run checks');
alter table public.analysis_runs enable row level security;
set local role anon;
select is(public.analysis_schema_ready_v2(), true, 'restored contract passes without reading user data');
reset role;
select * from finish();
rollback;
