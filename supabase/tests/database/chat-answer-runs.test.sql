begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- The seed's analysis aaaaaaaa... belongs to user 1111.... Add one for the other seed user.
insert into public.analyses (id, owner_id, source_type, source_text, summary, outcome)
values (
  '75000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222',
  'pasted_text', 'We collect email addresses.', 'Email collection.', 'no_findings'
);

create table pg_temp.runs (name text primary key, run_id uuid, chat_id uuid, question_id uuid);
grant all on pg_temp.runs to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Asking creates the chat, saves the question, and claims the answer.
insert into pg_temp.runs
select 'first', (r->>'runId')::uuid, (r->>'chatId')::uuid, (r->>'questionId')::uuid
from public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'What is collected?') as r
where r->>'status' = 'started';

select is((select count(*) from pg_temp.runs), 1::bigint, 'first question claims an answer');
select is(
  (select count(*) from public.chats where analysis_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'asking creates the chat'
);
select is(
  (select content from public.chat_messages
   where id = (select question_id from pg_temp.runs where name = 'first')),
  'What is collected?',
  'asking saves the question'
);
select is(
  (select status from public.chat_answer_runs),
  'running',
  'owner reads the running state'
);
select throws_ok(
  'select run_id from public.chat_answer_runs', '42501', null,
  'owner cannot read the run id'
);

-- A double click or second tab while answering claims nothing and saves no question.
select is(
  public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'What is collected?'),
  '{"status":"running","runId":null,"chatId":null,"questionId":null}'::jsonb,
  'second question while answering does not claim another answer'
);
select is(
  public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '{"status":"running","runId":null,"chatId":null,"questionId":null}'::jsonb,
  'retry while answering does not claim another answer'
);
select is(
  (select count(*) from public.chat_messages where role = 'user'),
  1::bigint,
  'no extra question is saved while answering'
);

select throws_ok($test$
  select public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', E' \n\t')
$test$, '22023', null, 'a blank question is rejected');
select throws_ok($test$
  select public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a', 2001))
$test$, '22023', null, 'a question over 2000 characters is rejected');

-- Only the holder of the run id can save.
select is(
  public.save_chat_answer(
    (select chat_id from pg_temp.runs where name = 'first'),
    '00000000-0000-4000-8000-000000000000',
    'Fabricated.', 'answered', '[]'::jsonb
  ),
  null,
  'saving with the wrong run id saves nothing'
);
select is(
  (select count(*) from public.chat_messages where role = 'assistant'),
  0::bigint,
  'no answer was saved without the run id'
);

select throws_ok($test$
  select public.save_chat_answer(
    (select chat_id from pg_temp.runs where name = 'first'),
    (select run_id from pg_temp.runs where name = 'first'),
    'Email addresses.', 'chitchat', '[]'::jsonb
  )
$test$, '23514', null, 'an unknown answer kind is rejected');

select isnt(
  public.save_chat_answer(
    (select chat_id from pg_temp.runs where name = 'first'),
    (select run_id from pg_temp.runs where name = 'first'),
    'The policy collects email addresses.',
    'answered',
    '[{"excerpt":"ExampleCo collects your email address","startOffset":0,"endOffset":37,"passageId":"P001","match":"exact"}]'::jsonb
  ),
  null,
  'the run holder saves the answer'
);
select is(
  (select answer_kind || ':' || (supporting_excerpts->0->>'excerpt')
   from public.chat_messages where role = 'assistant'),
  'answered:ExampleCo collects your email address',
  'the answer keeps its kind and excerpts'
);
select is(
  (select count(*) from public.chat_answer_runs),
  0::bigint,
  'saving the answer clears the run'
);
select is(
  public.save_chat_answer(
    (select chat_id from pg_temp.runs where name = 'first'),
    (select run_id from pg_temp.runs where name = 'first'),
    'Again.', 'answered', '[]'::jsonb
  ),
  null,
  'a finished run cannot save a second answer'
);
select is(
  public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '{"status":"nothing_to_retry","runId":null,"chatId":null,"questionId":null}'::jsonb,
  'there is nothing to retry after a saved answer'
);

-- A failed answer is recorded and can be retried without saving the question again.
insert into pg_temp.runs
select 'second', (r->>'runId')::uuid, (r->>'chatId')::uuid, (r->>'questionId')::uuid
from public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Is it sold?') as r
where r->>'status' = 'started';

select is(
  (select chat_id from pg_temp.runs where name = 'second'),
  (select chat_id from pg_temp.runs where name = 'first'),
  'later questions use the same chat'
);
select ok(
  public.fail_chat_answer(
    (select chat_id from pg_temp.runs where name = 'second'),
    (select run_id from pg_temp.runs where name = 'second'),
    'provider_timeout', 'The answer provider timed out.'
  ),
  'the run holder records a failure'
);
select is(
  (select status || ':' || error_code from public.chat_answer_runs),
  'failed:provider_timeout',
  'owner reads the failure'
);
select is(
  public.fail_chat_answer(
    (select chat_id from pg_temp.runs where name = 'second'),
    (select run_id from pg_temp.runs where name = 'second'),
    'internal_error', 'Again.'
  ),
  false,
  'a failed run cannot be failed again'
);

insert into pg_temp.runs
select 'retry', (r->>'runId')::uuid, (r->>'chatId')::uuid, (r->>'questionId')::uuid
from public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') as r
where r->>'status' = 'started';

select is(
  (select question_id from pg_temp.runs where name = 'retry'),
  (select question_id from pg_temp.runs where name = 'second'),
  'a retry answers the failed question again'
);
select is(
  (select count(*) from public.chat_messages where role = 'user'),
  2::bigint,
  'a retry does not save the question again'
);
select is(
  public.fail_chat_answer(
    (select chat_id from pg_temp.runs where name = 'second'),
    (select run_id from pg_temp.runs where name = 'second'),
    'provider_timeout', 'Late.'
  ),
  false,
  'a late failure from the replaced run does not end the retry'
);

-- An answer whose server stopped before finishing expires, and a new question can be asked.
reset role;
update public.chat_answer_runs set expires_at = pg_catalog.now() - interval '1 second';
set local role authenticated;

select is(
  (public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Can I delete it?'))->>'status',
  'started',
  'an expired answer does not block a new question'
);

-- Another user cannot ask about, see, save, or fail this chat.
set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select throws_ok($test$
  select public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Let me in.')
$test$, '42501', null, 'another user cannot ask about someone else''s analysis');
select is((select count(*) from public.chat_answer_runs), 0::bigint, 'another user sees no runs');
select is(
  public.fail_chat_answer(
    (select chat_id from pg_temp.runs where name = 'first'),
    (select run_id from pg_temp.runs where name = 'retry'),
    'internal_error', 'Not yours.'
  ),
  false,
  'another user cannot fail someone else''s answer even with its ids'
);
select is(
  public.save_chat_answer(
    (select chat_id from pg_temp.runs where name = 'first'),
    (select run_id from pg_temp.runs where name = 'retry'),
    'Not yours.', 'answered', '[]'::jsonb
  ),
  null,
  'another user cannot answer in someone else''s chat even with its ids'
);
select is(
  (public.start_chat_answer('75000000-0000-4000-8000-000000000001', 'Mine?'))->>'status',
  'started',
  'another user''s own chat is independent'
);

-- Clients write answers only through the functions.
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok($test$
  insert into public.chat_answer_runs (chat_id, question_id, status, run_id, expires_at)
  select chat_id, question_id, 'running', gen_random_uuid(), now() from pg_temp.runs limit 1
$test$, '42501', null, 'owner cannot write runs directly');
select throws_ok($test$
  delete from public.chat_answer_runs
$test$, '42501', null, 'owner cannot clear a run directly');
select throws_ok($test$
  insert into public.chat_messages (chat_id, role, content, answer_kind)
  select chat_id, 'user', 'Hi', 'answered' from pg_temp.runs limit 1
$test$, '42501', null, 'owner cannot set an answer kind directly');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($test$
  select public.start_chat_answer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Hi')
$test$, '42501', null, 'anonymous users cannot ask');
select throws_ok(
  'select * from public.chat_answer_runs', '42501', null, 'anonymous users cannot read runs'
);

-- Deleting the analysis removes its chat's run.
reset role;
delete from public.analyses where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select count(*) from public.chat_answer_runs
   where chat_id = (select chat_id from pg_temp.runs where name = 'first')),
  0::bigint,
  'analysis deletion removes its chat''s run'
);

select * from finish();
rollback;
