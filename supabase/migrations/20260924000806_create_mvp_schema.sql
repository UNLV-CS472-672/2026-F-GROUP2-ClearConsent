-- ClearConsent MVP database schema

-- Reusable trigger function for tables with an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

-- Stores the authenticated user's current privacy-preference set.
-- No row means the user has not configured preferences.
create table public.privacy_preferences (
  user_id uuid primary key
    references auth.users (id)
    on delete cascade,

  preferences jsonb not null,
  schema_version integer not null default 1,

  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint privacy_preferences_object_check
    check (jsonb_typeof(preferences) = 'object'),

  constraint privacy_preferences_not_empty_check
    check (preferences <> '{}'::jsonb),

  constraint privacy_preferences_schema_version_check
    check (schema_version > 0)
);

create trigger set_privacy_preferences_updated_at
before update on public.privacy_preferences
for each row
execute function public.set_updated_at();

-- Identifies how the analyzed source entered the application.
create type public.analysis_source_type as enum (
  'url',
  'pasted_text'
);

-- Distinguishes a successful result containing findings from a
-- successful result where no supported practices were identified.
create type public.analysis_outcome as enum (
  'findings_identified',
  'no_findings'
);

-- Stores one completed analysis owned by an authenticated user.
create table public.analyses (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references auth.users (id)
    on delete cascade,

  source_type public.analysis_source_type not null,
  source_title text,
  submitted_url text,
  final_url text,
  source_text text not null,

  summary text not null,
  outcome public.analysis_outcome not null,
  result_schema_version integer not null default 1,

  -- Preserves the exact preference context used for this result.
  -- Both fields are null when no personalized evaluation was performed.
  preference_snapshot jsonb,
  preference_schema_version integer,

  analyzed_at timestamptz not null default pg_catalog.now(),
  saved_at timestamptz not null default pg_catalog.now(),

  constraint analyses_source_text_check
    check (length(btrim(source_text)) > 0),

  constraint analyses_summary_check
    check (length(btrim(summary)) > 0),

  constraint analyses_result_schema_version_check
    check (result_schema_version > 0),

  constraint analyses_source_fields_check
    check (
      (
        source_type = 'url'
        and submitted_url is not null
        and length(btrim(submitted_url)) > 0
      )
      or
      (
        source_type = 'pasted_text'
        and submitted_url is null
        and final_url is null
      )
    ),

  constraint analyses_preference_snapshot_check
    check (
      (
        preference_snapshot is null
        and preference_schema_version is null
      )
      or
      (
        preference_snapshot is not null
        and jsonb_typeof(preference_snapshot) = 'object'
        and preference_snapshot <> '{}'::jsonb
        and preference_schema_version is not null
        and preference_schema_version > 0
      )
    )
);

-- Supports an owner's history page ordered newest first.
create index analyses_owner_history_idx
  on public.analyses (owner_id, saved_at desc);

-- Stores individual source-supported privacy practices.
create table public.findings (
  id uuid primary key default gen_random_uuid(),

  analysis_id uuid not null
    references public.analyses (id)
    on delete cascade,

  -- Examples include collection, use, sharing, retention, and user choices.
  -- The shared data contract will define the accepted category values.
  category text not null,

  plain_language_description text not null,

  -- JSON array of one or more evidence objects. Each object can contain
  -- an excerpt and optional start/end positions in the stored source text.
  evidence jsonb not null,

  data_categories text[] not null default array[]::text[],
  purposes text[] not null default array[]::text[],
  recipients text[] not null default array[]::text[],

  condition_note text,
  uncertainty_note text,

  display_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),

  constraint findings_category_check
    check (length(btrim(category)) > 0),

  constraint findings_description_check
    check (length(btrim(plain_language_description)) > 0),

  constraint findings_evidence_check
    check (
      jsonb_typeof(evidence) = 'array'
      and jsonb_array_length(evidence) > 0
    ),

  constraint findings_display_order_check
    check (display_order >= 0),

  constraint findings_data_categories_no_null_check
    check (array_position(data_categories, null) is null),

  constraint findings_purposes_no_null_check
    check (array_position(purposes, null) is null),

  constraint findings_recipients_no_null_check
    check (array_position(recipients, null) is null)
);

-- Supports loading findings in their intended UI order.
create index findings_analysis_order_idx
  on public.findings (analysis_id, display_order, id);

-- Supports building the Data Footprint by finding category.
create index findings_analysis_category_idx
  on public.findings (analysis_id, category);

-- Personalized indicators describe preference alignment, not legal safety.
create type public.preference_alignment_indicator as enum (
  'alignment',
  'conflict',
  'insufficient_evidence'
);

-- Allows a composite foreign key to ensure that a referenced finding
-- belongs to the same analysis as its preference evaluation.
alter table public.findings
  add constraint findings_analysis_id_id_unique
  unique (analysis_id, id);

-- Stores the personalized interpretation produced from a saved
-- preference and the findings for one completed analysis.
create table public.preference_evaluations (
  id uuid primary key default gen_random_uuid(),

  analysis_id uuid not null
    references public.analyses (id)
    on delete cascade,

  -- May be null when the indicator reports an evidence gap.
  finding_id uuid,

  preference_key text not null,
  preference_value jsonb not null,

  indicator public.preference_alignment_indicator not null,
  explanation text not null,

  display_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),

  constraint preference_evaluations_finding_fk
    foreign key (analysis_id, finding_id)
    references public.findings (analysis_id, id)
    on delete cascade,

  constraint preference_evaluations_preference_key_check
    check (length(btrim(preference_key)) > 0),

  constraint preference_evaluations_preference_value_check
    check (jsonb_typeof(preference_value) <> 'null'),

  constraint preference_evaluations_explanation_check
    check (length(btrim(explanation)) > 0),

  constraint preference_evaluations_display_order_check
    check (display_order >= 0),

  -- Alignment and conflict must point to supporting findings.
  -- Insufficient evidence may instead describe a missing finding.
  constraint preference_evaluations_finding_required_check
    check (
      indicator = 'insufficient_evidence'
      or finding_id is not null
    )
);

-- Supports loading evaluations in their intended UI order.
create index preference_evaluations_analysis_order_idx
  on public.preference_evaluations (analysis_id, display_order, id);

-- Supports foreign-key checks and finding-based retrieval.
create index preference_evaluations_finding_idx
  on public.preference_evaluations (analysis_id, finding_id)
  where finding_id is not null;

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------

alter table public.privacy_preferences enable row level security;
alter table public.analyses enable row level security;
alter table public.findings enable row level security;
alter table public.preference_evaluations enable row level security;

-- Remove Supabase's default Data API privileges before granting only
-- the operations required by the MVP.
revoke all
  on table
    public.privacy_preferences,
    public.analyses,
    public.findings,
    public.preference_evaluations
  from anon, authenticated;

-- Grant authenticated users only the operations required by the MVP.
grant select, insert, update, delete
  on table public.privacy_preferences
  to authenticated;

-- Saved analyses are immutable, but owners may create, read, and delete them.
grant select, insert, delete
  on table public.analyses
  to authenticated;

-- Findings and evaluations are created with an analysis and remain immutable.
grant select, insert
  on table public.findings, public.preference_evaluations
  to authenticated;

grant usage
  on type
    public.analysis_source_type,
    public.analysis_outcome,
    public.preference_alignment_indicator
  to authenticated;

-- Privacy-preference ownership policies.

create policy privacy_preferences_select_own
on public.privacy_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy privacy_preferences_insert_own
on public.privacy_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy privacy_preferences_update_own
on public.privacy_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy privacy_preferences_delete_own
on public.privacy_preferences
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Saved-analysis ownership policies.

create policy analyses_select_own
on public.analyses
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy analyses_insert_own
on public.analyses
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy analyses_delete_own
on public.analyses
for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- Finding ownership is inherited from the parent analysis.
create policy findings_select_own
on public.findings
for select
to authenticated
using (
  exists (
    select 1
    from public.analyses as parent_analysis
    where parent_analysis.id = findings.analysis_id
      and parent_analysis.owner_id = (select auth.uid())
  )
);

create policy findings_insert_own
on public.findings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.analyses as parent_analysis
    where parent_analysis.id = findings.analysis_id
      and parent_analysis.owner_id = (select auth.uid())
  )
);

-- Preference-evaluation ownership is inherited from the parent analysis.

create policy preference_evaluations_select_own
on public.preference_evaluations
for select
to authenticated
using (
  exists (
    select 1
    from public.analyses as parent_analysis
    where parent_analysis.id = preference_evaluations.analysis_id
      and parent_analysis.owner_id = (select auth.uid())
  )
);

create policy preference_evaluations_insert_own
on public.preference_evaluations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.analyses as parent_analysis
    where parent_analysis.id = preference_evaluations.analysis_id
      and parent_analysis.owner_id = (select auth.uid())
  )
);
