-- Persist synthetic analysis output through the real save RPC, without a provider call.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
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
      'source_id', (select id from public.find_or_create_pasted_source('We share location with advertisers.')),
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

select lives_ok($test$
 select * from public.find_or_create_pasted_source('We share location with advertisers.')
$test$, 'synthetic paste saves a source');

select is((select count(*) from public.sources s
 join public.analyses a on a.source_id = s.id
 where s.text = 'We share location with advertisers.'), 0::bigint,
 'source without a completed analysis is excluded from the History inner join');

select is(pg_temp.save_fixture('82000000-0000-4000-8000-000000000001'),
 '82000000-0000-4000-8000-000000000001'::uuid,
 'mocked completed output saves through the real analysis RPC');

select is((select count(*) from public.sources s
 join public.analyses a on a.source_id = s.id
 where s.text = 'We share location with advertisers.'), 1::bigint,
 'completed mocked analysis is retrievable with the History inner join');

select is((select f.plain_language_description from public.findings f
 join public.analyses a on a.id = f.analysis_id
 join public.sources s on s.id = a.source_id
 where s.text = 'We share location with advertisers.'),
 'Location is shared with advertisers.', 'saved mocked finding is retrievable');

set local request.jwt.claims =
 '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*) from public.sources s
 join public.analyses a on a.source_id = s.id
 where s.text = 'We share location with advertisers.'), 0::bigint,
 'other user cannot retrieve the saved analysis through History');
select * from finish();
rollback;
