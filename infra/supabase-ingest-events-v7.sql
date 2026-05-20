-- OdiePt V7 - Ingest audit events
-- Hevy webhook, daily events sync and backfill audit trail.
-- This does not replace workouts.external_source/external_id idempotency;
-- it records what arrived and how each event was processed.

create table if not exists ingest_events (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id) on delete set null,
  source       text not null default 'hevy',
  external_id  text not null default '',
  event_type   text not null default 'sync'
    check (event_type in ('created','updated','deleted','webhook','backfill','sync')),
  operation    text not null default 'sync',
  status       text not null default 'received'
    check (status in ('received','processed','failed','skipped')),
  error        text,
  payload      jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists ingest_events_profile_created_idx
  on ingest_events(profile_id, created_at desc);

create index if not exists ingest_events_source_external_idx
  on ingest_events(source, external_id, created_at desc);

alter table if exists public.ingest_events disable row level security;
