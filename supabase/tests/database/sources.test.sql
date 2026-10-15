begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

-- Use the two synthetic users provided by the existing seed.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok($test$
  insert into public.sources (id, owner_id, title, text, url)
  values (
    'c1111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'Synthetic policy',
    E'First paragraph.\nSecond paragraph.',
    'https://example.com/privacy'
  )
$test$, 'owner can save an extracted source');

select is(
  (select text from public.sources
   where id = 'c1111111-1111-4111-8111-111111111111'),
  E'First paragraph.\nSecond paragraph.',
  'owner reads exact extracted text'
);

select lives_ok($test$
  insert into public.sources (owner_id, text)
  values (
    '11111111-1111-4111-8111-111111111111',
    'Source without a title or URL'
  )
$test$, 'title and URL are optional and ID is generated');

select throws_ok($test$
  insert into public.sources (owner_id, text)
  values ('11111111-1111-4111-8111-111111111111', '')
$test$, '23514', null, 'empty text is rejected');

select throws_ok($test$
  insert into public.sources (owner_id, text)
  values ('11111111-1111-4111-8111-111111111111', E' \t\n\r ')
$test$, '23514', null, 'whitespace-only text is rejected');

select throws_ok($test$
  insert into public.sources (owner_id, text)
  values ('11111111-1111-4111-8111-111111111111', null)
$test$, '23502', null, 'null text is rejected');

select throws_ok($test$
  insert into public.sources (owner_id, text, url)
  values (
    '11111111-1111-4111-8111-111111111111',
    'Synthetic policy',
    E' \t\n '
  )
$test$, '23514', null, 'blank URL is rejected');

select throws_ok($test$
  insert into public.sources (owner_id, text)
  values (
    '22222222-2222-4222-8222-222222222222',
    'Spoofed ownership'
  )
$test$, '42501', null, 'owner cannot create a source for another user');

select throws_ok($test$
  update public.sources set text = 'Changed'
  where id = 'c1111111-1111-4111-8111-111111111111'
$test$, '42501', null, 'stored source text cannot be updated');

-- A second authenticated user cannot read or delete the first user's source.
set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.sources)::bigint,
  0::bigint,
  'second user cannot read first user sources'
);

with removed as (
  delete from public.sources
  where id = 'c1111111-1111-4111-8111-111111111111'
  returning id
)
select is(
  count(*)::bigint, 0::bigint,
  'second user cannot delete first user source'
) from removed;

select lives_ok($test$
  insert into public.sources (id, owner_id, text)
  values (
    'c2222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'Second user source'
  )
$test$, 'second user can save their own source');

-- Anonymous access is denied.
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select * from public.sources',
  '42501', null, 'anonymous users cannot read sources'
);

select throws_ok($test$
  insert into public.sources (owner_id, text)
  values (
    '11111111-1111-4111-8111-111111111111',
    'Anonymous source'
  )
$test$, '42501', null, 'anonymous users cannot insert sources');

-- Owner deletion actually removes the row.
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

with removed as (
  delete from public.sources
  where id = 'c1111111-1111-4111-8111-111111111111'
  returning id
)
select is(
  count(*)::bigint, 1::bigint,
  'owner can delete their source'
) from removed;

-- Verify account deletion with administrator visibility.
reset role;

delete from auth.users
where id = '11111111-1111-4111-8111-111111111111';

select is(
  (select count(*) from public.sources
   where owner_id = '11111111-1111-4111-8111-111111111111')::bigint,
  0::bigint,
  'account deletion removes remaining owned sources'
);

select is(
  (select count(*) from public.sources
   where id = 'c2222222-2222-4222-8222-222222222222')::bigint,
  1::bigint,
  'account deletion preserves another user source'
);

select * from finish();
rollback;
