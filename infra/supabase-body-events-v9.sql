-- OdiePt Sakatlik Sistemi V1
-- Focused body_events truth migration. Intentionally does not seed a wrist event.

create table if not exists public.body_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  kind text not null default 'injury',
  region text not null,
  side text default 'unknown',
  severity integer not null default 3 check (severity between 1 and 5),
  recovery_percent integer not null default 70 check (recovery_percent between 0 and 100),
  expected_clear_at date,
  status text not null default 'active',
  note text default '',
  source text default 'manual',
  odie_interpretation jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.body_events add column if not exists profile_id uuid references public.profiles(id) on delete cascade;
alter table public.body_events add column if not exists kind text not null default 'injury';
alter table public.body_events add column if not exists region text not null default 'core';
alter table public.body_events add column if not exists side text default 'unknown';
alter table public.body_events add column if not exists severity integer not null default 3;
alter table public.body_events add column if not exists recovery_percent integer not null default 70;
alter table public.body_events add column if not exists expected_clear_at date;
alter table public.body_events add column if not exists status text not null default 'active';
alter table public.body_events add column if not exists note text default '';
alter table public.body_events add column if not exists source text default 'manual';
alter table public.body_events add column if not exists odie_interpretation jsonb default '{}'::jsonb;
alter table public.body_events add column if not exists created_at timestamptz not null default now();
alter table public.body_events add column if not exists updated_at timestamptz not null default now();

create index if not exists body_events_profile_status_idx
  on public.body_events(profile_id, status, created_at desc);

create index if not exists body_events_profile_region_status_idx
  on public.body_events(profile_id, region, status, created_at desc);

create index if not exists body_events_updated_at_idx
  on public.body_events(updated_at desc);

create or replace function public.set_body_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists body_events_set_updated_at on public.body_events;
create trigger body_events_set_updated_at
  before update on public.body_events
  for each row execute function public.set_body_events_updated_at();

alter table if exists public.body_events disable row level security;

do $$
begin
  alter publication supabase_realtime add table public.body_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
