-- Tracks the in-progress or failed analysis run for each source, so a page visit, refresh,
-- or second tab cannot start another paid run while one is underway or after one failed.
-- A completed run removes its row; the saved analysis is then the source's state.
create type public.analysis_run_status as enum ('running', 'failed');

create table public.analysis_runs (
  source_id uuid primary key,
  owner_id uuid not null,

  status public.analysis_run_status not null,
  -- New on every start and returned only to the server that started the run. Finishing a run
  -- requires it, so a client cannot end a run it does not hold, and a late finish from an
  -- expired run cannot overwrite a newer one. Not readable through the table grants.
  run_id uuid not null,

  error_code text,
  error_message text,

  started_at timestamptz not null default pg_catalog.now(),
  -- A running row past this time is treated as failed (the server stopped before finishing).
  expires_at timestamptz not null,
  finished_at timestamptz,

  constraint analysis_runs_owned_source_fk
    foreign key (owner_id, source_id)
    references public.sources (owner_id, id)
    on delete cascade,

  constraint analysis_runs_state_check
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

create index analysis_runs_owner_idx
  on public.analysis_runs (owner_id);

alter table public.analysis_runs enable row level security;

-- Owners read their run state, except run_id. All writes go through the functions below, so a
-- client cannot clear a run to bypass the one-run-per-source rule.
revoke all
  on table public.analysis_runs
  from anon, authenticated;

grant select (
  source_id, owner_id, status, error_code, error_message, started_at, expires_at, finished_at
)
  on table public.analysis_runs
  to authenticated;

grant usage
  on type public.analysis_run_status
  to authenticated;

create policy analysis_runs_select_own
on public.analysis_runs
for select
to authenticated
using ((select auth.uid()) = owner_id);

comment on table public.analysis_runs is
  'In-progress or failed analysis run per source; written only by the run functions.';

-- Returns {"status": ..., "runId": ...}. status is one of:
--   started:  this caller holds a new run (runId) and must finish it with complete_analysis_run
--             or fail_analysis_run. runId is null for every other status.
--   running:  another run for this source is still in progress.
--   failed:   the last run failed (or expired); pass p_retry = true to start a new one.
--   complete: the source already has a saved analysis.
-- SECURITY DEFINER because authenticated users cannot write analysis_runs directly; ownership
-- is checked explicitly against auth.uid().
create function public.start_analysis_run(
  p_source_id uuid,
  p_retry boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_run public.analysis_runs%rowtype;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.sources as s
    where s.id = p_source_id and s.owner_id = v_owner
  ) then
    raise exception 'Source is unavailable to this user' using errcode = '42501';
  end if;

  -- Serialize starts for this source, including concurrent requests from several tabs.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('analysis_run:' || p_source_id::text, 0)
  );

  if exists (
    select 1 from public.analyses as a
    where a.source_id = p_source_id and a.owner_id = v_owner
  ) then
    return jsonb_build_object('status', 'complete', 'runId', null);
  end if;

  select r.* into v_run
  from public.analysis_runs as r
  where r.source_id = p_source_id;

  if found then
    if v_run.status = 'running' and v_run.expires_at > pg_catalog.now() then
      return jsonb_build_object('status', 'running', 'runId', null);
    end if;
    if not p_retry then
      return jsonb_build_object('status', 'failed', 'runId', null);
    end if;
  end if;

  -- Two provider calls of at most 5 minutes each (OPENAI_TIMEOUT_CEILING_MS), plus margin.
  insert into public.analysis_runs as r (source_id, owner_id, status, run_id, expires_at)
  values (
    p_source_id, v_owner, 'running', pg_catalog.gen_random_uuid(), pg_catalog.now() + interval '15 minutes'
  )
  on conflict (source_id) do update
    set status = 'running',
        run_id = excluded.run_id,
        error_code = null,
        error_message = null,
        started_at = pg_catalog.now(),
        expires_at = pg_catalog.now() + interval '15 minutes',
        finished_at = null
  returning r.* into v_run;

  return jsonb_build_object('status', 'started', 'runId', v_run.run_id);
end;
$$;

-- Records a failure for the caller's run. Returns false when the run is no longer the current
-- one (it expired and was restarted), so an old failure never replaces a newer run.
create function public.fail_analysis_run(
  p_source_id uuid,
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

  update public.analysis_runs
  set status = 'failed',
      error_code = p_error_code,
      error_message = p_error_message,
      finished_at = pg_catalog.now()
  where source_id = p_source_id
    and owner_id = v_owner
    and run_id = p_run_id
    and status = 'running';

  return found;
end;
$$;

-- Clears the caller's run after its analysis was saved.
create function public.complete_analysis_run(
  p_source_id uuid,
  p_run_id uuid
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

  delete from public.analysis_runs
  where source_id = p_source_id
    and owner_id = v_owner
    and run_id = p_run_id
    and status = 'running';

  return found;
end;
$$;

revoke all on function public.start_analysis_run(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.fail_analysis_run(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_analysis_run(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.start_analysis_run(uuid, boolean) to authenticated;
grant execute on function public.fail_analysis_run(uuid, uuid, text, text) to authenticated;
grant execute on function public.complete_analysis_run(uuid, uuid) to authenticated;
