-- Minimum persisted evidence shape from the existing seed/design. #22 owns extensions.
create function public.evidence_objects_valid(value jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
 select case when jsonb_typeof(value) = 'array' then
  jsonb_array_length(value) > 0 and not exists (
   select 1 from jsonb_array_elements(value) as item
   where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'excerpt') is distinct from 'string'
      or length(btrim(item->>'excerpt')) = 0
  )
 else false end;
$$;
revoke all on function public.evidence_objects_valid(jsonb) from public;
grant execute on function public.evidence_objects_valid(jsonb) to authenticated;
alter table public.findings drop constraint findings_evidence_check;
alter table public.findings add constraint findings_evidence_check
 check (public.evidence_objects_valid(evidence));
