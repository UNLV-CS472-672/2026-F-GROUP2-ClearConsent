-- Synthetic local-development data for ClearConsent.
-- These UUID-only Auth records are not login accounts.

begin;

insert into auth.users (id)
values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.privacy_preferences (
  user_id,
  preferences,
  schema_version
)
values (
  '11111111-1111-4111-8111-111111111111',
  '{
    "email_collection": "allow",
    "service_improvement": "avoid",
    "third_party_sharing": "avoid",
    "data_retention": "shortest_possible"
  }'::jsonb,
  1
);

commit;

-- A completed personalized analysis with source-supported findings.

begin;

insert into public.analyses (
  id,
  owner_id,
  source_type,
  source_title,
  source_text,
  summary,
  outcome,
  result_schema_version,
  preference_snapshot,
  preference_schema_version,
  analyzed_at,
  saved_at
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'pasted_text',
  'ExampleCo Privacy Policy',
  'ExampleCo collects your email address to create and maintain your account. We use usage data to improve our services. We may share your email address with analytics service providers.',
  'ExampleCo collects an email address for account management, uses usage data to improve its services, and may share an email address with analytics providers.',
  'findings_identified',
  1,
  '{
    "email_collection": "allow",
    "service_improvement": "avoid",
    "third_party_sharing": "avoid",
    "data_retention": "shortest_possible"
  }'::jsonb,
  1,
  '2026-09-24 00:00:00+00',
  '2026-09-24 00:00:05+00'
);

insert into public.findings (
  id,
  analysis_id,
  category,
  plain_language_description,
  evidence,
  data_categories,
  purposes,
  recipients,
  display_order
)
values
(
  'b1111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'collection',
  'ExampleCo collects the user''s email address.',
  '[{"excerpt":"ExampleCo collects your email address to create and maintain your account."}]'::jsonb,
  array['email_address'],
  array['account_management'],
  array[]::text[],
  0
),
(
  'b2222222-2222-4222-8222-222222222222',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'use',
  'ExampleCo uses usage data to improve its services.',
  '[{"excerpt":"We use usage data to improve our services."}]'::jsonb,
  array['usage_data'],
  array['service_improvement'],
  array[]::text[],
  1
),
(
  'b3333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'sharing',
  'ExampleCo may share the user''s email address with analytics providers.',
  '[{"excerpt":"We may share your email address with analytics service providers."}]'::jsonb,
  array['email_address'],
  array['analytics'],
  array['analytics_service_providers'],
  2
);

insert into public.preference_evaluations (
  id,
  analysis_id,
  finding_id,
  preference_key,
  preference_value,
  indicator,
  explanation,
  display_order
)
values
(
  'c1111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'b1111111-1111-4111-8111-111111111111',
  'email_collection',
  '"allow"'::jsonb,
  'alignment',
  'Email collection for account management aligns with the saved preference.',
  0
),
(
  'c2222222-2222-4222-8222-222222222222',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'b2222222-2222-4222-8222-222222222222',
  'service_improvement',
  '"avoid"'::jsonb,
  'conflict',
  'Use of usage data for service improvement conflicts with the saved preference.',
  1
),
(
  'c3333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'b3333333-3333-4333-8333-333333333333',
  'third_party_sharing',
  '"avoid"'::jsonb,
  'conflict',
  'Sharing an email address with analytics providers conflicts with the saved preference.',
  2
),
(
  'c4444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  null,
  'data_retention',
  '"shortest_possible"'::jsonb,
  'insufficient_evidence',
  'The source does not state how long the described data is retained.',
  3
);

commit;