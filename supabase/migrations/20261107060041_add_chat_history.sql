-- Deleting a source also removes the saved analyses that reference it.
alter table public.analyses
  drop constraint analyses_owned_source_fk,
  add constraint analyses_owned_source_fk
    foreign key (owner_id, source_id)
    references public.sources (owner_id, id)
    on delete cascade;

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references public.analyses (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (content ~ '[^[:space:]]'),
  supporting_excerpts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint chat_messages_supporting_excerpts_check check (
    jsonb_typeof(supporting_excerpts) = 'array'
    and (role = 'assistant' or supporting_excerpts = '[]'::jsonb)
  )
);

create index chat_messages_history_idx
  on public.chat_messages (chat_id, created_at, id);

alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

revoke all on public.chats, public.chat_messages from public, anon, authenticated, service_role;
grant select on public.chats, public.chat_messages to authenticated;
grant insert (analysis_id) on public.chats to authenticated;
grant insert (chat_id, role, content) on public.chat_messages to authenticated;

-- The API uses its server-only credential for assistant messages.
grant select, insert on public.chat_messages to service_role;

create policy chats_select_own
on public.chats for select to authenticated
using (
  exists (
    select 1 from public.analyses as analysis
    where analysis.id = chats.analysis_id
      and analysis.owner_id = (select auth.uid())
  )
);

create policy chats_insert_own
on public.chats for insert to authenticated
with check (
  exists (
    select 1 from public.analyses as analysis
    where analysis.id = chats.analysis_id
      and analysis.owner_id = (select auth.uid())
  )
);

-- The subquery sees only chats visible to the current user under chats_select_own.
create policy chat_messages_select_own
on public.chat_messages for select to authenticated
using (
  exists (select 1 from public.chats as chat where chat.id = chat_messages.chat_id)
);

create policy chat_messages_insert_own_question
on public.chat_messages for insert to authenticated
with check (
  role = 'user'
  and exists (select 1 from public.chats as chat where chat.id = chat_messages.chat_id)
);
