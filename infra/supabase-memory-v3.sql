-- OdiePt V3 memory layer only
-- Run this in Supabase SQL Editor on the existing production database.

create extension if not exists pgcrypto;

create table if not exists athlete_memory (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid references profiles(id) on delete cascade,
  memory_type       text not null default 'episodic',
  scope             text not null default 'global',
  key               text not null,
  summary           text not null default '',
  value_jsonb       jsonb not null default '{}'::jsonb,
  confidence        numeric not null default 0.7,
  source            text not null default 'system_derived',
  active            boolean not null default true,
  last_confirmed_at timestamptz,
  last_used_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique(profile_id, scope, key)
);

create index if not exists athlete_memory_profile_idx
  on athlete_memory(profile_id, active, scope);

create table if not exists memory_feedback (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references profiles(id) on delete cascade,
  coach_note_id uuid references coach_notes(id) on delete set null,
  memory_id     uuid references athlete_memory(id) on delete set null,
  feedback_type text not null default 'correct',
  note          text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists memory_feedback_profile_idx
  on memory_feedback(profile_id, created_at desc);

create table if not exists body_metrics_history (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  date       date not null default current_date,
  weight_kg  numeric,
  height_cm  numeric,
  source     text not null default 'telegram',
  note       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists body_metrics_history_profile_idx
  on body_metrics_history(profile_id, date desc, created_at desc);

create table if not exists workout_blocks (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id) on delete cascade,
  workout_id   uuid references workouts(id) on delete cascade,
  kind         text not null default 'mixed',
  label        text not null default '',
  weight_pct   int not null default 0,
  tags         jsonb not null default '[]'::jsonb,
  sets         int not null default 0,
  reps         int,
  volume_kg    numeric not null default 0,
  duration_min int not null default 0,
  distance_km  numeric not null default 0,
  source       text not null default 'session',
  created_at   timestamptz not null default now()
);

create index if not exists workout_blocks_workout_idx
  on workout_blocks(workout_id, created_at desc);

create index if not exists workout_blocks_profile_idx
  on workout_blocks(profile_id, kind, created_at desc);

create table if not exists workout_facts (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id) on delete cascade,
  workout_id   uuid references workouts(id) on delete cascade,
  fact_kind    text not null default 'activity',
  raw          text not null default '',
  label        text not null default '',
  duration_min int not null default 0,
  distance_km  numeric not null default 0,
  block_kind   text not null default 'mixed',
  signals      jsonb not null default '[]'::jsonb,
  tags         jsonb not null default '[]'::jsonb,
  confidence   numeric not null default 0.65,
  created_at   timestamptz not null default now()
);

create index if not exists workout_facts_workout_idx
  on workout_facts(workout_id, created_at desc);

create index if not exists workout_facts_profile_idx
  on workout_facts(profile_id, block_kind, created_at desc);
