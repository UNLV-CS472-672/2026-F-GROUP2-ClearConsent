-- Minimum persisted evidence shape from the existing seed/design. #22 owns extensions.
create function public.evidence_objects_valid(value jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
 -- Guard array-only functions, require at least one item, and reject the whole
 -- array if any element is invalid.
 select case when jsonb_typeof(value) = 'array' then
  jsonb_array_length(value) > 0 and not exists (
   select 1 from jsonb_array_elements(value) as item
   -- Missing keys yield SQL NULL; IS DISTINCT FROM catches them where a normal
   -- comparison could let an object without an excerpt pass.
   where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'excerpt') is distinct from 'string'
      -- Require a non-whitespace character: btrim alone misses tabs and newlines.
      or (item->>'excerpt') !~ '[^[:space:]]'
  )
 else false end;
$$;
revoke all on function public.evidence_objects_valid(jsonb) from public;
grant execute on function public.evidence_objects_valid(jsonb) to authenticated;
-- Adding the stricter constraint validates existing rows too. Invalid stored
-- evidence stops the migration instead of silently rewriting or discarding data.
alter table public.findings drop constraint findings_evidence_check;
alter table public.findings add constraint findings_evidence_check
 check (public.evidence_objects_valid(evidence));
