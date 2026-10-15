-- Stores extracted documents before AI processing.
-- Column names match extractFromUrl(): title, text, and url.
create table public.sources (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references auth.users (id)
    on delete cascade,

  -- A document may have no extractable title.
  title text,
  text text not null,

  -- Final URL returned by extraction; null for non-URL sources.
  url text,

  created_at timestamptz not null default pg_catalog.now(),

  constraint sources_text_not_blank_check
    check (text ~ '[^[:space:]]'),

  constraint sources_url_not_blank_check
    check (url is null or url ~ '[^[:space:]]')
);

-- Supports owner-scoped retrieval and account deletion.
create index sources_owner_created_at_idx
  on public.sources (owner_id, created_at desc);

alter table public.sources enable row level security;

revoke all
  on table public.sources
  from anon, authenticated;

-- Preserve extracted text as an immutable snapshot.
-- A new extraction creates a new source record.
grant select, insert, delete
  on table public.sources
  to authenticated;

create policy sources_select_own
on public.sources
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy sources_insert_own
on public.sources
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy sources_delete_own
on public.sources
for delete
to authenticated
using ((select auth.uid()) = owner_id);

comment on table public.sources is
  'Owner-scoped extracted documents stored before AI processing.';

comment on column public.sources.text is
  'Exact extracted text; preserve unchanged for later evidence references.';

comment on column public.sources.url is
  'Final URL returned by the extractor after redirects, when applicable.';
