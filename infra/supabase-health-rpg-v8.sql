-- OdiePt V8 - Health RPG telemetry ledger + daily summary
-- Run after supabase-ingest-events-v7.sql and supabase-health-v7.sql.

create table if not exists health_telemetry (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  source          text not null default 'apple_health',
  external_source text not null default 'apple_health_shortcut',
  external_id     text not null default '',
  kind            text not null
    check (kind in ('workout','activity_day','sleep','heart','body_metric')),
  metric_type     text not null,
  day             date not null default current_date,
  start_at        timestamptz,
  end_at          timestamptz,
  value_num       numeric,
  unit            text not null default '',
  value_jsonb     jsonb not null default '{}'::jsonb,
  raw_jsonb       jsonb not null default '{}'::jsonb,
  confidence      numeric not null default 0.86,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists health_telemetry_external_metric_uidx
  on health_telemetry(profile_id, external_source, external_id, metric_type);

create index if not exists health_telemetry_profile_day_idx
  on health_telemetry(profile_id, day desc, kind);

create table if not exists health_daily_summary (
  id                 uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles(id) on delete cascade,
  day                 date not null default current_date,
  sleep_score         int,
  movement_score      int,
  heart_score         int,
  recovery_score      int,
  strain_score        int,
  data_confidence     int not null default 0,
  sleep_hours         numeric not null default 0,
  deep_sleep_hours    numeric not null default 0,
  rem_sleep_hours     numeric not null default 0,
  core_sleep_hours    numeric not null default 0,
  awake_minutes       int not null default 0,
  sleep_efficiency    int,
  steps               int not null default 0,
  distance_km         numeric not null default 0,
  active_energy_kcal  int not null default 0,
  exercise_minutes    int not null default 0,
  resting_heart_rate  int,
  avg_heart_rate      int,
  max_heart_rate      int,
  walking_heart_rate  int,
  hrv_sdnn            int,
  strain_notes        jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(profile_id, day)
);

create index if not exists health_daily_summary_profile_day_idx
  on health_daily_summary(profile_id, day desc);

alter table daily_logs add column if not exists active_energy_kcal int not null default 0;
alter table daily_logs add column if not exists resting_heart_rate int;
alter table daily_logs add column if not exists hrv_sdnn int;
alter table daily_logs add column if not exists data_confidence int not null default 0;
alter table daily_logs add column if not exists source text not null default 'manual';

alter table workouts add column if not exists avg_heart_rate int;
alter table workouts add column if not exists max_heart_rate int;
alter table workouts add column if not exists active_energy_kcal int not null default 0;

alter table if exists public.health_telemetry disable row level security;
alter table if exists public.health_daily_summary disable row level security;

do $$
begin
  alter publication supabase_realtime add table health_daily_summary;
exception
  when duplicate_object then null;
end $$;
