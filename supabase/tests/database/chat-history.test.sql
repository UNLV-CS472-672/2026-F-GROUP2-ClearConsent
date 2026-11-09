begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

-- Use the seed's historical analysis to test a chat without a source link.
-- Add a source-linked analysis to verify that deleting its source removes its chat.
insert into public.sources (id, owner_id, text)
values (
  '74000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'We collect email addresses.'
);

insert into public.analyses (id, owner_id, source_id, source_type, source_text, summary, outcome)
values (
  '74000000-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  '74000000-0000-4000-8000-000000000001',
  'pasted_text', 'We collect email addresses.', 'Email collection.', 'no_findings'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select throws_ok($test$
  insert into public.chats (analysis_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
$test$, '42501', null, 'another user cannot create a chat for someone else''s analysis');

set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok($test$
  insert into public.chats (analysis_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
         ('74000000-0000-4000-8000-000000000002')
$test$, 'owner can create chats for historical and source-linked analyses');

select throws_ok($test$
  insert into public.chats (analysis_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
$test$, '23505', null, 'an analysis can have only one chat');

select lives_ok($test$
  insert into public.chat_messages (chat_id, role, content)
  select id, 'user', 'What data is collected?' from public.chats
$test$, 'owner can save a question in each chat');

select throws_ok($test$
  insert into public.chat_messages (chat_id, role, content)
  select id, 'user', E' \t\n' from public.chats limit 1
$test$, '23514', null, 'a whitespace-only question is rejected');

select throws_ok($test$
  insert into public.chat_messages (chat_id, role, content)
  select id, 'assistant', 'Fabricated answer' from public.chats limit 1
$test$, '42501', null, 'an authenticated owner cannot fabricate assistant messages');

-- Simulate the API saving an answer after authorizing the analysis owner.
select set_config(
  'test.chat_history_chat_id',
  (select id::text from public.chats where analysis_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  true
);

reset role;
set local role service_role;

select lives_ok($test$
  insert into public.chat_messages (chat_id, role, content, supporting_excerpts)
  values (
    current_setting('test.chat_history_chat_id')::uuid,
    'assistant', 'The policy collects your email address.',
    '[{"excerpt":"ExampleCo collects your email address"}]'::jsonb
  )
$test$, 'trusted API can save an answer with supporting excerpts');

reset role;
set local role authenticated;

select is(
  (select count(*) from public.chats), 2::bigint,
  'owner can read both chats'
);

select is(
  (select supporting_excerpts->0->>'excerpt' from public.chat_messages where role = 'assistant'),
  'ExampleCo collects your email address',
  'owner can read the saved answer evidence'
);

set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is((select count(*) from public.chats), 0::bigint, 'another user sees no chats');
select is((select count(*) from public.chat_messages), 0::bigint, 'another user sees no messages');

select throws_ok($test$
  insert into public.chat_messages (chat_id, role, content)
  values (current_setting('test.chat_history_chat_id')::uuid, 'user', 'Unauthorized question')
$test$, '42501', null, 'another user cannot write even with a known chat ID');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok('select * from public.chats', '42501', null, 'anonymous users cannot read chats');
select throws_ok(
  'select * from public.chat_messages', '42501', null, 'anonymous users cannot read messages'
);
select throws_ok($test$
  insert into public.chats (analysis_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
$test$, '42501', null, 'anonymous users cannot create chats');
select throws_ok($test$
  insert into public.chat_messages (chat_id, role, content)
  values (current_setting('test.chat_history_chat_id')::uuid, 'user', 'Anonymous question')
$test$, '42501', null, 'anonymous users cannot create messages');

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

delete from public.sources where id = '74000000-0000-4000-8000-000000000001';
reset role;

select is(
  (select count(*) from public.analyses where id = '74000000-0000-4000-8000-000000000002'),
  0::bigint, 'source deletion removes the linked analysis'
);
select is(
  (select analysis_id from public.chats), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'source deletion removes only the linked chat'
);
select is((select count(*) from public.chat_messages), 2::bigint, 'source deletion removes only linked messages');

set local role authenticated;
delete from public.analyses where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
reset role;

select is((select count(*) from public.chats), 0::bigint, 'analysis deletion removes its chat');
select is((select count(*) from public.chat_messages), 0::bigint, 'analysis deletion removes its messages');

select * from finish();
rollback;
