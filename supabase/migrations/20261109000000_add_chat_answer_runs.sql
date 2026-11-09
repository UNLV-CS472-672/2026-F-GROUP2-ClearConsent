-- Answers in a chat go through the functions below. One answer per chat can be in progress at a
-- time, so a double click, refresh, or second tab cannot start another paid call. A failed answer
-- is recorded so the page can offer Try again. Same pattern as analysis_runs.

-- How the model classified the question it answered (FR-11). Null on questions.
alter table public.chat_messages
  add column answer_kind text,
  add constraint chat_messages_answer_kind_check
    check (
      answer_kind is null
      or (
        role = 'assistant'
        and answer_kind in ('answered', 'not_in_policy', 'out_of_scope', 'legal_advice')
      )
    );

-- The in-progress or failed answer for each chat. A saved answer removes the row; the answer
-- message is then the chat's state.
create table public.chat_answer_runs (
  chat_id uuid primary key
    references public.chats (id)
    on delete cascade,
  -- The question being answered. A retry answers the same question again.
  question_id uuid not null
    references public.chat_messages (id)
    on delete cascade,

  status text not null,
  -- New on every start and returned to whoever called start_chat_answer, which is normally the
  -- chat API. Saving or failing an answer requires it, so a late finish from an expired answer
  -- cannot overwrite a newer one. It is not readable through the table grants. It does not stop
  -- an owner who calls these functions directly from saving their own answer to their own chat;
  -- the API's quote checks only apply to answers it saves.
  run_id uuid not null,

  error_code text,
  error_message text,

  started_at timestamptz not null default pg_catalog.now(),
  -- A running row past this time is treated as failed (the server stopped before finishing).
  expires_at timestamptz not null,
  finished_at timestamptz,

  constraint chat_answer_runs_state_check
    check (
      (
        status = 'running'
        and error_code is null
        and error_message is null
        and finished_at is null
      )
      or
      (
        status = 'failed'
        and length(btrim(error_code)) > 0
        and length(btrim(error_message)) > 0
        and finished_at is not null
      )
    )
);

create index chat_answer_runs_question_idx
  on public.chat_answer_runs (question_id);

alter table public.chat_answer_runs enable row level security;

revoke all
  on table public.chat_answer_runs
  from public, anon, authenticated, service_role;

grant select (
  chat_id, question_id, status, error_code, error_message, started_at, expires_at, finished_at
)
  on table public.chat_answer_runs
  to authenticated;

-- The subquery sees only chats visible to the current user under chats_select_own.
create policy chat_answer_runs_select_own
on public.chat_answer_runs
for select
to authenticated
using (
  exists (select 1 from public.chats as chat where chat.id = chat_answer_runs.chat_id)
);

comment on table public.chat_answer_runs is
  'In-progress or failed answer per chat; written only by the chat answer functions.';

-- Starts answering a question about the caller's analysis, creating its chat if needed.
-- With p_question, saves it as a new question. Without it, retries the chat's failed (or expired)
-- question. Returns {"status", "runId", "chatId", "questionId"}, where status is one of:
--   started:          this caller holds the answer (runId) and must end it with save_chat_answer
--                     or fail_chat_answer. The ids are null for every other status.
--   running:          another answer in this chat is still in progress.
--   nothing_to_retry: a retry was asked for, but no answer in this chat failed.
-- SECURITY DEFINER because authenticated users cannot write answer runs or assistant messages;
-- ownership is checked explicitly against auth.uid().
create function public.start_chat_answer(
  p_analysis_id uuid,
  p_question text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_chat_id uuid;
  v_question_id uuid;
  v_run public.chat_answer_runs%rowtype;
  v_has_run boolean;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.analyses as a
    where a.id = p_analysis_id and a.owner_id = v_owner
  ) then
    raise exception 'Analysis is unavailable to this user' using errcode = '42501';
  end if;

  -- Matches the API's checks. btrim only removes spaces, so blankness uses the same pattern as
  -- the chat_messages content check.
  if p_question is not null
    and (p_question !~ '[^[:space:]]' or length(p_question) > 2000)
  then
    raise exception 'Question must be nonblank and at most 2000 characters'
      using errcode = '22023';
  end if;

  -- Serialize starts for this analysis's chat, including concurrent requests from several tabs.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chat_answer:' || p_analysis_id::text, 0)
  );

  insert into public.chats (analysis_id)
  values (p_analysis_id)
  on conflict (analysis_id) do nothing;

  select c.id into v_chat_id
  from public.chats as c
  where c.analysis_id = p_analysis_id;

  select r.* into v_run
  from public.chat_answer_runs as r
  where r.chat_id = v_chat_id;
  v_has_run := found;

  if v_has_run and v_run.status = 'running' and v_run.expires_at > pg_catalog.now() then
    return jsonb_build_object(
      'status', 'running', 'runId', null, 'chatId', null, 'questionId', null
    );
  end if;

  if p_question is null then
    if not v_has_run then
      return jsonb_build_object(
        'status', 'nothing_to_retry', 'runId', null, 'chatId', null, 'questionId', null
      );
    end if;
    v_question_id := v_run.question_id;
  else
    insert into public.chat_messages (chat_id, role, content)
    values (v_chat_id, 'user', p_question)
    returning id into v_question_id;
  end if;

  -- One answer call of at most 60 seconds (CHAT_TIMEOUT_MS), plus margin.
  insert into public.chat_answer_runs as r (chat_id, question_id, status, run_id, expires_at)
  values (
    v_chat_id, v_question_id, 'running', pg_catalog.gen_random_uuid(),
    pg_catalog.now() + interval '2 minutes'
  )
  on conflict (chat_id) do update
    set question_id = excluded.question_id,
        status = 'running',
        run_id = excluded.run_id,
        error_code = null,
        error_message = null,
        started_at = pg_catalog.now(),
        expires_at = excluded.expires_at,
        finished_at = null
  returning r.* into v_run;

  return jsonb_build_object(
    'status', 'started',
    'runId', v_run.run_id,
    'chatId', v_chat_id,
    'questionId', v_question_id
  );
end;
$$;

-- Saves the answer for the caller's run and clears the run, in one transaction. Returns the new
-- message as {"id", "createdAt"}, or null when the run is no longer the current one (it expired
-- and was restarted).
create function public.save_chat_answer(
  p_chat_id uuid,
  p_run_id uuid,
  p_answer text,
  p_answer_kind text,
  p_supporting_excerpts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_message public.chat_messages%rowtype;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.chat_answer_runs as r
  using public.chats as c, public.analyses as a
  where r.chat_id = p_chat_id
    and r.run_id = p_run_id
    and r.status = 'running'
    and c.id = r.chat_id
    and a.id = c.analysis_id
    and a.owner_id = v_owner;

  if not found then
    return null;
  end if;

  insert into public.chat_messages (chat_id, role, content, supporting_excerpts, answer_kind)
  values (p_chat_id, 'assistant', p_answer, p_supporting_excerpts, p_answer_kind)
  returning * into v_message;

  return jsonb_build_object('id', v_message.id, 'createdAt', v_message.created_at);
end;
$$;

-- Records a failure for the caller's run. Returns false when the run is no longer the current one.
create function public.fail_chat_answer(
  p_chat_id uuid,
  p_run_id uuid,
  p_error_code text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.chat_answer_runs as r
  set status = 'failed',
      error_code = p_error_code,
      error_message = p_error_message,
      finished_at = pg_catalog.now()
  from public.chats as c, public.analyses as a
  where r.chat_id = p_chat_id
    and r.run_id = p_run_id
    and r.status = 'running'
    and c.id = r.chat_id
    and a.id = c.analysis_id
    and a.owner_id = v_owner;

  return found;
end;
$$;

revoke all on function public.start_chat_answer(uuid, text)
  from public, anon, authenticated;
revoke all on function public.save_chat_answer(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_chat_answer(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.start_chat_answer(uuid, text) to authenticated;
grant execute on function public.save_chat_answer(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.fail_chat_answer(uuid, uuid, text, text) to authenticated;
