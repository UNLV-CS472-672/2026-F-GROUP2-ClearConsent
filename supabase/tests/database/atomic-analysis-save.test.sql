begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Synthetic sources for the two existing seed users.
insert into public.sources (id, owner_id, title, text) values
(
  '51000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Synthetic policy',
  'We share location with advertisers.'
),
(
  '51000000-0000-4000-8000-000000000002',
  '22222222-2222-4222-8222-222222222222',
  'Other user policy',
  'We share location with advertisers.'
);

-- Fixture builder only; runs with the caller's privileges.
-- Each analysis gets its own deterministic finding UUID.
create function pg_temp.save_fixture(
  analysis_id uuid,
  changes jsonb default '{}'::jsonb,
  findings_override jsonb default null,
  evaluations_override jsonb default null
)
returns uuid
language sql
security invoker
as $$
  select public.save_analysis(
    jsonb_build_object(
      'id', analysis_id,
      'source_id', '51000000-0000-4000-8000-000000000001',
      'source_type', 'pasted_text',
      'source_text', 'We share location with advertisers.',
      'summary', 'Location is shared with advertisers.',
      'outcome', 'findings_identified',
      'analysis_status', 'complete',
      'preference_snapshot', '{"profile":"balanced","levels":{"sharing":"major"},"rulesVersion":"1"}'::jsonb,
      'preference_schema_version', 1
    ) || changes,
    coalesce(findings_override, jsonb_build_array(jsonb_build_object(
      'id', md5(analysis_id::text)::uuid,
      'analysis_id', analysis_id,
      'category', 'sharing',
      'plain_language_description', 'Location is shared with advertisers.',
      'evidence', '[{"excerpt":"We share location with advertisers."}]'::jsonb,
      'effect', 'exposes',
      'purpose_types', array['advertising'],
      'recipient_types', array['advertiser']
    ))),
    coalesce(evaluations_override, jsonb_build_array(jsonb_build_object(
      'concern', 'sharing',
      'level', 'major',
      'indicator', 'conflict',
      'findingId', md5(analysis_id::text)::uuid,
      'explanation', 'Sharing conflicts with your major concern.'
    )))
  );
$$;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  pg_temp.save_fixture('61000000-0000-4000-8000-000000000001'),
  '61000000-0000-4000-8000-000000000001'::uuid,
  'save returns the analysis UUID'
);

select is(
  (select source_id from public.analyses
   where id = '61000000-0000-4000-8000-000000000001'),
  '51000000-0000-4000-8000-000000000001'::uuid,
  'analysis links to its source'
);

select is(
  (select count(*) from public.findings
   where analysis_id = '61000000-0000-4000-8000-000000000001'),
  1::bigint, 'finding is saved'
);

select is(
  (select finding_id from public.preference_evaluations
   where analysis_id = '61000000-0000-4000-8000-000000000001'),
  md5('61000000-0000-4000-8000-000000000001')::uuid,
  'evaluation references the saved finding UUID'
);

select is(
  (select preference_value from public.preference_evaluations
   where analysis_id = '61000000-0000-4000-8000-000000000001'),
  '"major"'::jsonb, 'level is stored as a JSON string'
);

select is(
  pg_temp.save_fixture('61000000-0000-4000-8000-000000000001'),
  '61000000-0000-4000-8000-000000000001'::uuid,
  'identical retry succeeds'
);

select is(
  (select count(*) from public.preference_evaluations
   where analysis_id = '61000000-0000-4000-8000-000000000001'),
  1::bigint, 'retry creates no duplicate evaluation'
);

select throws_ok($test$
  select pg_temp.save_fixture(
    '61000000-0000-4000-8000-000000000001',
    '{"summary":"Different result"}'
  )
$test$, '22023', null, 'changed payload cannot overwrite a saved result');

select throws_ok($test$
  select pg_temp.save_fixture(
    '61000000-0000-4000-8000-000000000002',
    '{"analysis_status":"in_progress"}'
  )
$test$, '22023', null, 'incomplete analysis is rejected');

select throws_ok($test$
  select pg_temp.save_fixture(
    '61000000-0000-4000-8000-000000000002',
    '{"source_text":"Different text"}'
  )
$test$, '22023', null, 'source text mismatch is rejected');

select throws_ok($test$
  select pg_temp.save_fixture(
    '61000000-0000-4000-8000-000000000002',
    '{"source_id":"51000000-0000-4000-8000-000000000002"}'
  )
$test$, '42501', null, 'another user source is rejected');

select throws_ok($test$
  select pg_temp.save_fixture(
    '61000000-0000-4000-8000-000000000002',
    '{"owner_id":"22222222-2222-4222-8222-222222222222"}'
  )
$test$, '42501', null, 'spoofed owner is rejected');

-- Fail at the last insert, after the analysis and finding inserts.
select throws_ok($test$
  select pg_temp.save_fixture(
    '61000000-0000-4000-8000-000000000002', '{}', null,
    '[{"concern":"sharing","level":"major","indicator":"conflict",
       "findingId":"71000000-0000-4000-8000-000000000099",
       "explanation":"Unknown finding"}]'
  )
$test$, '23503', null, 'unknown finding reference fails');

reset role;

select is(
  (select count(*) from public.analyses
   where id = '61000000-0000-4000-8000-000000000002'),
  0::bigint, 'failed save rolls back the analysis'
);

select is(
  (select count(*) from public.findings
   where analysis_id = '61000000-0000-4000-8000-000000000002'),
  0::bigint, 'failed evaluation rolls back previously inserted findings'
);

select is(
  (select count(*) from public.preference_evaluations
   where analysis_id = '61000000-0000-4000-8000-000000000002'),
  0::bigint, 'failed save leaves no evaluations'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok($test$
  select pg_temp.save_fixture(
    '61000000-0000-4000-8000-000000000002', '{}', null,
    '[{"concern":"sharing","level":"major","indicator":"conflict",
       "findingId":null,"explanation":"Missing reference"}]'
  )
$test$, '23514', null, 'conflict requires a finding');

select lives_ok($test$
  select pg_temp.save_fixture(
    '61000000-0000-4000-8000-000000000003',
    '{"outcome":"no_findings"}', '[]',
    '[{"concern":"sharing","level":"major",
       "indicator":"insufficient_evidence","findingId":null,
       "explanation":"The policy does not address sharing."}]'
  )
$test$, 'no-findings result accepts insufficient evidence with null findingId');

select is(
  (select finding_id is null from public.preference_evaluations
   where analysis_id = '61000000-0000-4000-8000-000000000003'),
  true, 'null finding reference is preserved'
);

select throws_ok($test$
  delete from public.sources
  where id = '51000000-0000-4000-8000-000000000001'
$test$, '23503', null, 'source cannot be deleted while analyses reference it');

-- A direct insert must also obey the same-owner foreign key.
select throws_ok($test$
  insert into public.analyses (
    owner_id, source_id, source_type, source_text, summary, outcome
  ) values (
    '11111111-1111-4111-8111-111111111111',
    '51000000-0000-4000-8000-000000000002',
    'pasted_text', 'Synthetic text', 'Synthetic summary', 'no_findings'
  )
$test$, '23503', null, 'foreign key blocks cross-owner links outside the function');

set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.analyses
   where id = '61000000-0000-4000-8000-000000000001'),
  0::bigint, 'second user cannot read saved analysis'
);

select throws_ok($test$
  select pg_temp.save_fixture('61000000-0000-4000-8000-000000000001')
$test$, '42501', null, 'second user cannot replay another owner save');

reset role;
set local role anon;
select throws_ok($test$
  select public.save_analysis('{}', '[]', '[]')
$test$, '42501', null, 'anonymous role cannot execute save function');

-- Account deletion should cascade through both sources and analyses.
reset role;
delete from auth.users
where id = '11111111-1111-4111-8111-111111111111';

select is(
  (select count(*) from public.analyses
   where owner_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint, 'account deletion removes linked analyses'
);

select is(
  (select count(*) from public.sources
   where owner_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint, 'account deletion removes owned sources'
);

select is(
  (select count(*) from public.sources
   where id = '51000000-0000-4000-8000-000000000002'),
  1::bigint, 'other owner source survives account deletion'
);

select * from finish();
rollback;
