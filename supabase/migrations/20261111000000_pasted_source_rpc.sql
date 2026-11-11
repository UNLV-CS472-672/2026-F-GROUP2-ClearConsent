-- A digest narrows candidates; exact text comparison defines identity, even on collision.
-- Keep existing duplicate rows and their analysis/history references intact.
create index sources_paste_digest_idx
  on public.sources (owner_id, md5(text)) where url is null;

create function public.find_or_create_pasted_source(p_text text, p_title text default null)
returns setof public.sources
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  found_source public.sources;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_text is null or p_text !~ '[^[:space:]]' then
    raise exception 'Text cannot be blank' using errcode = '22023';
  end if;

  -- RPC calls use POST bodies. No document text appears in a lookup URL.
  -- Serialize identical owner/text submissions, including the first insert.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller::text || ':' || pg_catalog.md5(p_text), 0)
  );
  select s.* into found_source from public.sources s
  where s.owner_id = caller and s.url is null
    and pg_catalog.md5(s.text) = pg_catalog.md5(p_text) and s.text = p_text
  order by s.created_at, s.id limit 1;

  if not found then
    insert into public.sources (owner_id, title, text, url)
    values (caller, p_title, p_text, null) returning * into found_source;
  end if;
  return next found_source;
end;
$$;

revoke all on function public.find_or_create_pasted_source(text, text) from public, anon;
grant execute on function public.find_or_create_pasted_source(text, text) to authenticated;
