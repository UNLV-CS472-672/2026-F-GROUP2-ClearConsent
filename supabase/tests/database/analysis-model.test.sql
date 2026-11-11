begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.sources (id, owner_id, title, text) values (
  '86000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Synthetic policy',
  'We share location with advertisers.'
);

-- Saves a no-findings analysis for the source above, with the given extra analysis fields.
create function pg_temp.save_with(analysis_id uuid, changes jsonb default '{}'::jsonb)
returns uuid
language sql
security invoker
as $$
  select public.save_analysis(
    jsonb_build_object(
      'id', analysis_id,
      'source_id', '86000000-0000-4000-8000-000000000001',
      'source_type', 'pasted_text',
      'source_text', 'We share location with advertisers.',
      'summary', 'Location is shared with advertisers.',
      'outcome', 'no_findings',
      'analysis_status', 'complete'
    ) || changes,
    '[]'::jsonb,
    '[]'::jsonb
  );
$$;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok($test$
  select pg_temp.save_with(
    '86000000-0000-4000-8000-000000000011',
    '{"model":"gpt-6-luna","reasoning_effort":"medium"}'
  )
$test$, 'an analysis saves with its model and reasoning effort');

select is(
  (select model || ':' || reasoning_effort from public.analyses
   where id = '86000000-0000-4000-8000-000000000011'),
  'gpt-6-luna:medium',
  'the owner reads back the model and reasoning effort'
);

select lives_ok($test$
  select pg_temp.save_with('86000000-0000-4000-8000-000000000012')
$test$, 'an analysis without a model still saves, as older callers did');

select is(
  (select model is null and reasoning_effort is null from public.analyses
   where id = '86000000-0000-4000-8000-000000000012'),
  true,
  'an analysis saved without them has neither'
);

select throws_ok($test$
  select pg_temp.save_with(
    '86000000-0000-4000-8000-000000000013',
    '{"model":"gpt-6-luna"}'
  )
$test$, '23514', null, 'a model without a reasoning effort is rejected');

select throws_ok($test$
  select pg_temp.save_with(
    '86000000-0000-4000-8000-000000000014',
    '{"model":" ","reasoning_effort":"medium"}'
  )
$test$, '23514', null, 'a blank model is rejected');

-- An identical retry still returns the saved analysis.
select is(
  pg_temp.save_with(
    '86000000-0000-4000-8000-000000000011',
    '{"model":"gpt-6-luna","reasoning_effort":"medium"}'
  ),
  '86000000-0000-4000-8000-000000000011'::uuid,
  'an identical retry with the model returns the same analysis'
);

select * from finish();
rollback;
