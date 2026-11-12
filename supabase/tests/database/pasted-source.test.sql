begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok($test$
 select * from public.find_or_create_pasted_source(repeat('日本語&?#%😀', 5000))
$test$, 'near-limit Unicode and reserved characters save');
select is(
 (select id from public.find_or_create_pasted_source('Synthetic privacy policy')),
 (select id from public.find_or_create_pasted_source('Synthetic privacy policy')),
 'repeated submissions reuse the same source'
);
select is((select count(*) from public.sources where text = 'Synthetic privacy policy'), 1::bigint,
 'only one source exists');
select throws_ok($test$ select * from public.find_or_create_pasted_source('') $test$,
 '22023', null, 'empty input is rejected');
select throws_ok($test$ select * from public.find_or_create_pasted_source(null) $test$,
 '22023', null, 'null input is rejected');
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*) from public.sources), 0::bigint, 'other owner sources are invisible');
select is((select owner_id from public.find_or_create_pasted_source('Synthetic privacy policy')),
 '22222222-2222-4222-8222-222222222222'::uuid, 'same text belongs to the caller');
reset role;
select is((select count(*) from public.sources where text = 'Synthetic privacy policy'), 2::bigint,
 'identical text has separate rows for different owners');
set local role anon;
select throws_ok($test$ select * from public.find_or_create_pasted_source('Synthetic privacy policy') $test$,
 '42501', null, 'anonymous RPC execution is denied');
select * from finish();
rollback;
