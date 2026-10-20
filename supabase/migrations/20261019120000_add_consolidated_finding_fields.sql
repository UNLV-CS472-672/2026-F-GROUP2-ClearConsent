-- What this migration does, in plain language:
-- Stage 2 (consolidation) produces the findings that are saved for a completed analysis.
-- This keeps the existing findings table and adds the fields Stage 2 produces and issue #12
-- needs for personalized indicators. No new table is created.
--
-- 1. category becomes a fixed list instead of any text: collection, use, sharing, retention,
--    user_rights, or security_practices. The existing seed rows already use these values.
-- 2. effect says which side a finding is on: 'exposes' (a practice, or a missing or restricted
--    protection) or 'protects' (a protection, or a denial such as "we do not sell"). It is
--    nullable so older rows stay valid; issue #12 sends a finding without one to review.
-- 3. ambiguous and conditional are true/false flags. An ambiguous finding must explain what is
--    unclear in uncertainty_note, and a conditional finding must state its condition in
--    condition_note.
-- 4. purpose_types and recipient_types hold fixed values next to the existing free-text
--    purposes and recipients, so scoring can rely on them without parsing wording.
-- 5. relevant_preferences lists the preference keys a finding relates to. It only affects
--    display order.
--
-- Existing grants and row-level security policies cover the new columns, so no access rules
-- change. PostgreSQL checks existing rows against the new constraints; if any row is invalid,
-- the migration fails instead of changing data.

alter table public.findings drop constraint findings_category_check;
alter table public.findings add constraint findings_category_check
  check (
    category in (
      'collection',
      'use',
      'sharing',
      'retention',
      'user_rights',
      'security_practices'
    )
  );

alter table public.findings
  add column effect text,
  add column ambiguous boolean not null default false,
  add column conditional boolean not null default false,
  add column purpose_types text[] not null default array[]::text[],
  add column recipient_types text[] not null default array[]::text[],
  add column relevant_preferences text[] not null default array[]::text[];

alter table public.findings
  add constraint findings_effect_check
    check (effect is null or effect in ('exposes', 'protects')),

  -- A blank or missing note fails, so the flag must come with real text. coalesce is needed
  -- because a regex test on null gives null, and a CHECK treats null as passing.
  add constraint findings_ambiguous_note_check
    check (not ambiguous or coalesce(uncertainty_note ~ '[^[:space:]]', false)),

  add constraint findings_conditional_note_check
    check (not conditional or coalesce(condition_note ~ '[^[:space:]]', false)),

  -- <@ means "every element is in this list". Null elements are rejected explicitly.
  add constraint findings_purpose_types_check
    check (
      purpose_types <@ array[
        'service',
        'legal_security',
        'analytics',
        'advertising',
        'sale',
        'other',
        'unspecified'
      ]::text[]
      and array_position(purpose_types, null) is null
    ),

  add constraint findings_recipient_types_check
    check (
      recipient_types <@ array[
        'service_provider',
        'affiliate',
        'advertiser',
        'data_broker',
        'government',
        'other',
        'unspecified'
      ]::text[]
      and array_position(recipient_types, null) is null
    ),

  add constraint findings_relevant_preferences_no_null_check
    check (array_position(relevant_preferences, null) is null);
