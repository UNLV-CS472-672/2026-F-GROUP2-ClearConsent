create table if not exists callback_logs (
  id bigint generated always as identity primary key,
  path text not null,
  query text,
  ip text,
  user_agent text,
  referer text,
  created_at timestamptz not null default now()
);

alter table callback_logs enable row level security;