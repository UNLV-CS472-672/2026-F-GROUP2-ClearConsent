-- Link saved analyses to extracted sources without changing historical rows.
alter table public.sources
  add constraint sources_owner_id_id_unique unique (owner_id, id);

alter table public.analyses
  add column source_id uuid,
  add column save_request_hash bytea,
  add constraint analyses_owned_source_fk
    foreign key (owner_id, source_id)
    references public.sources (owner_id, id)
    on delete no action;

create index analyses_owned_source_idx
  on public.analyses (owner_id, source_id)
  where source_id is not null;

comment on column public.analyses.source_id is
  'Source owned by the analysis owner; nullable for historical analyses.';

comment on column public.analyses.save_request_hash is
  'SHA-256 of the RPC inputs, used to recognize identical save retries.';

-- Inputs:
-- p_analysis: id, source_id, source_type, submitted_url, source_text,
--   summary, outcome, analysis_status, result_schema_version,
--   preference_snapshot, preference_schema_version.
-- p_findings: database-ready rows from toFindingRows().
-- p_evaluations: concern, level, indicator, findingId (mapped UUID or null),
--   explanation; array order becomes display_order.
--
-- The caller validates AI completion and maps finding identifiers first.
-- This function also checks the explicit completion flag and basic consistency.
-- SECURITY INVOKER keeps all existing table grants and RLS checks in effect.
create function public.save_analysis(
  p_analysis jsonb,
  p_findings jsonb,
  p_evaluations jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_analysis_id uuid;
  v_source_id uuid;
  v_source public.sources%rowtype;
  v_request_hash bytea;
  v_existing_hash bytea;
  v_item jsonb;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_analysis) is distinct from 'object'
     or jsonb_typeof(p_findings) is distinct from 'array'
     or jsonb_typeof(p_evaluations) is distinct from 'array' then
    raise exception 'Expected an analysis object and two arrays'
      using errcode = '22023';
  end if;

  if p_analysis->>'analysis_status' is distinct from 'complete' then
    raise exception 'Only completed analyses can be saved'
      using errcode = '22023';
  end if;

  v_analysis_id := (p_analysis->>'id')::uuid;
  v_source_id := (p_analysis->>'source_id')::uuid;

  if v_analysis_id is null or v_source_id is null then
    raise exception 'Analysis id and source_id are required'
      using errcode = '22023';
  end if;

  if p_analysis ? 'owner_id'
     and (p_analysis->>'owner_id')::uuid is distinct from v_owner then
    raise exception 'Analysis owner must be the authenticated user'
      using errcode = '42501';
  end if;

  -- Serialize retries for this analysis ID, including concurrent requests.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_analysis_id::text, 0)
  );

  v_request_hash := pg_catalog.sha256(pg_catalog.convert_to(
    jsonb_build_array(p_analysis, p_findings, p_evaluations)::text,
    'UTF8'
  ));

  select a.save_request_hash into v_existing_hash
  from public.analyses as a
  where a.id = v_analysis_id;

  if found then
    if v_existing_hash is not distinct from v_request_hash then
      return v_analysis_id;
    end if;
    raise exception 'Analysis id already exists with different save inputs'
      using errcode = '22023';
  end if;

  select s.* into v_source
  from public.sources as s
  where s.id = v_source_id and s.owner_id = v_owner;

  if not found then
    raise exception 'Source is unavailable to this user'
      using errcode = '42501';
  end if;

  -- Evidence offsets refer to this exact text snapshot.
  if p_analysis->>'source_text' is distinct from v_source.text then
    raise exception 'Analysis text must match the stored source exactly'
      using errcode = '22023';
  end if;

  if p_analysis->>'outcome' is null
     or p_analysis->>'outcome' not in ('findings_identified', 'no_findings')
     or (
       (p_analysis->>'outcome' = 'findings_identified')
       <> (jsonb_array_length(p_findings) > 0)
     ) then
    raise exception 'Outcome must agree with the findings array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_evaluations) > 0
     and (
       jsonb_typeof(p_analysis->'preference_snapshot')
         is distinct from 'object'
       or p_analysis->>'preference_schema_version' is null
     ) then
    raise exception 'Evaluations require a preference snapshot and version'
      using errcode = '22023';
  end if;

  -- Reject malformed child records before inserting anything.
  for v_item in select value from jsonb_array_elements(p_findings)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or v_item->>'id' is null
       or (v_item->>'analysis_id')::uuid is distinct from v_analysis_id
       or v_item->>'effect' is null then
      raise exception 'Each finding needs an id, matching analysis_id, and effect'
        using errcode = '22023';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_evaluations)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or not (v_item ? 'findingId')
       or jsonb_typeof(v_item->'concern') is distinct from 'string'
       or jsonb_typeof(v_item->'level') is distinct from 'string'
       or v_item->>'concern' not in (
         'collection', 'use', 'sharing', 'retention',
         'user_rights', 'security_practices'
       )
       or v_item->>'level' not in ('acceptable', 'concern', 'major') then
      raise exception 'Invalid evaluation concern, level, or missing findingId'
        using errcode = '22023';
    end if;
  end loop;

  insert into public.analyses (
    id, owner_id, source_id, source_type,
    source_title, submitted_url, final_url, source_text,
    summary, outcome, result_schema_version,
    preference_snapshot, preference_schema_version, save_request_hash
  ) values (
    v_analysis_id, v_owner, v_source_id,
    (p_analysis->>'source_type')::public.analysis_source_type,
    v_source.title, p_analysis->>'submitted_url', v_source.url, v_source.text,
    p_analysis->>'summary',
    (p_analysis->>'outcome')::public.analysis_outcome,
    coalesce((p_analysis->>'result_schema_version')::integer, 1),
    nullif(p_analysis->'preference_snapshot', 'null'::jsonb),
    (p_analysis->>'preference_schema_version')::integer,
    v_request_hash
  );

  insert into public.findings (
    id, analysis_id, category, plain_language_description, evidence,
    data_categories, purposes, recipients, condition_note, uncertainty_note,
    effect, ambiguous, conditional, purpose_types, recipient_types,
    relevant_preferences, display_order
  )
  select
    r.id, v_analysis_id, r.category, r.plain_language_description, r.evidence,
    coalesce(r.data_categories, array[]::text[]),
    coalesce(r.purposes, array[]::text[]),
    coalesce(r.recipients, array[]::text[]),
    r.condition_note, r.uncertainty_note, r.effect,
    coalesce(r.ambiguous, false), coalesce(r.conditional, false),
    coalesce(r.purpose_types, array[]::text[]),
    coalesce(r.recipient_types, array[]::text[]),
    coalesce(r.relevant_preferences, array[]::text[]),
    coalesce(r.display_order, 0)
  from jsonb_populate_recordset(null::public.findings, p_findings) as r;

  insert into public.preference_evaluations (
    analysis_id, finding_id, preference_key, preference_value,
    indicator, explanation, display_order
  )
  select
    v_analysis_id,
    (e.value->>'findingId')::uuid,
    e.value->>'concern',
    e.value->'level',
    (e.value->>'indicator')::public.preference_alignment_indicator,
    e.value->>'explanation',
    (e.ordinality - 1)::integer
  from jsonb_array_elements(p_evaluations)
    with ordinality as e(value, ordinality);

  -- Any exception above rolls back the complete function call.
  return v_analysis_id;
end;
$$;

revoke all on function public.save_analysis(jsonb, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.save_analysis(jsonb, jsonb, jsonb)
  to authenticated;

comment on function public.save_analysis(jsonb, jsonb, jsonb) is
  'Atomically saves an owned source-linked analysis and its findings/evaluations. Identical retries reuse the analysis UUID.';
