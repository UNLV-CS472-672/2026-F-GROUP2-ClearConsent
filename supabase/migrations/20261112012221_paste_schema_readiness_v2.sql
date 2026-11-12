-- Keep v1 unchanged: it has already been applied to hosted projects.
-- v2 adds #94's paste contract. It is intentionally false until that migration
-- is applied separately; this migration does not install the paste RPC.
create function public.analysis_schema_ready_v2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.analysis_schema_ready_v1()
    and exists (
      select 1 from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass('public.sources')
        and c.relkind = 'r' and c.relrowsecurity
        and pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
        and pg_catalog.has_table_privilege('authenticated', c.oid, 'INSERT')
    )
    and not exists (
      select 1 from (values
        ('id', 'uuid'), ('owner_id', 'uuid'), ('title', 'text'),
        ('text', 'text'), ('url', 'text'), ('created_at', 'timestamp with time zone')
      ) as required(name, type_name)
      where not exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass('public.sources')
          and a.attname = required.name and not a.attisdropped and a.attnum > 0
          and a.atttypid = pg_catalog.to_regtype(required.type_name)
      )
    )
    and exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.find_or_create_pasted_source(text,text)')
        and p.prokind = 'f' and p.proretset and not p.prosecdef
        and p.proargnames = array['p_text', 'p_title']
        and p.prorettype = pg_catalog.to_regtype('public.sources')
        and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    )
    and exists (
      select 1 from pg_catalog.pg_index i
      join pg_catalog.pg_class c on c.oid = i.indexrelid
      join pg_catalog.pg_am am on am.oid = c.relam
      where i.indexrelid = pg_catalog.to_regclass('public.sources_paste_digest_idx')
        and i.indrelid = pg_catalog.to_regclass('public.sources')
        and i.indisvalid and i.indisready and am.amname = 'btree'
        and i.indnatts = 2 and i.indnkeyatts = 2
        and pg_catalog.pg_get_indexdef(i.indexrelid, 1, false) = 'owner_id'
        and pg_catalog.pg_get_indexdef(i.indexrelid, 2, false) = 'md5(text)'
        and pg_catalog.pg_get_expr(i.indpred, i.indrelid) = '(url IS NULL)'
    );
$$;

revoke all on function public.analysis_schema_ready_v2() from public;
grant execute on function public.analysis_schema_ready_v2() to anon, authenticated;
comment on function public.analysis_schema_ready_v2() is
  'Read-only catalog prerequisite for analysis runs and pasted-source RPC/index; no user data or RPC execution.';
