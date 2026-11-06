-- A deliberately narrow public health contract: catalog metadata only, no user rows,
-- no dynamic SQL, no execution of the state-changing analysis RPCs, no elevated role.
-- Version the function name when changing the required release contract.
create function public.analysis_schema_ready_v1()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'analysis_runs'
        and c.relkind = 'r' and c.relrowsecurity
    )
    and not exists (
      select 1 from (values
        ('source_id', 'uuid'), ('owner_id', 'uuid'), ('run_id', 'uuid'),
        ('status', 'public.analysis_run_status'),
        ('error_code', 'text'), ('error_message', 'text'),
        ('started_at', 'timestamp with time zone'),
        ('expires_at', 'timestamp with time zone'),
        ('finished_at', 'timestamp with time zone')
      ) as required(name, type_name)
      where not exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass('public.analysis_runs')
          and a.attname = required.name and not a.attisdropped and a.attnum > 0
          and a.atttypid = pg_catalog.to_regtype(required.type_name)
      )
    )
    and not exists (
      select 1 from (values
        ('public.start_analysis_run(uuid,boolean)',
          array['p_source_id', 'p_retry'], 'jsonb'),
        ('public.fail_analysis_run(uuid,uuid,text,text)',
          array['p_source_id', 'p_run_id', 'p_error_code', 'p_error_message'], 'boolean'),
        ('public.release_analysis_run(uuid,uuid)',
          array['p_source_id', 'p_run_id'], 'boolean')
      ) as required(signature, arg_names, result_type)
      where not exists (
        select 1 from pg_catalog.pg_proc p
        where p.oid = pg_catalog.to_regprocedure(required.signature)
          and p.prokind = 'f' and not p.proretset
          and p.proargnames = required.arg_names
          and p.prorettype = pg_catalog.to_regtype(required.result_type)
          and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      )
    );
$$;

revoke all on function public.analysis_schema_ready_v1() from public;
grant execute on function public.analysis_schema_ready_v1() to anon, authenticated;
comment on function public.analysis_schema_ready_v1() is
  'Read-only boolean release prerequisite for the analysis-run schema; exposes no user data.';
