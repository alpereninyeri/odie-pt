-- OdiePt V2 Migration — Class / Survival / Epic sütunları
-- Supabase SQL Editor'da çalıştır (mevcut schema üzerine uygulanır)

-- ── Profiles tablosuna yeni sütunlar ─────────────────────────────────────────
alter table profiles add column if not exists armor_current     int  not null default 100;
alter table profiles add column if not exists armor_max         int  not null default 100;
alter table profiles add column if not exists fatigue_current   int  not null default 0;
alter table profiles add column if not exists consecutive_heavy int  not null default 0;
alter table profiles add column if not exists injury_until      date;
alter table profiles add column if not exists survival_status   text not null default 'healthy'
  check (survival_status in ('healthy','cns_overloaded','tendon_alarm','critical_wear','injured'));

-- Class Evolution
alter table profiles add column if not exists class_id          text not null default 'cirak';
alter table profiles add column if not exists body_metrics      jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists class_locked_at   timestamptz;

-- Epic progress (hesaplanabilir ama cache için)
alter table profiles add column if not exists total_km          numeric not null default 0;
alter table profiles add column if not exists total_meters_climbed numeric not null default 0;

-- ── Workouts: heavy/pr flag'ı (engine için) ─────────────────────────────────
alter table workouts add column if not exists is_heavy          boolean not null default false;
alter table workouts add column if not exists fatigue_delta     int  not null default 0;
alter table workouts add column if not exists armor_delta       int  not null default 0;

-- ── Seed: mevcut profili sıfırlamadan güvenli default'lar ────────────────────
update profiles
  set armor_current = coalesce(armor_current, 100),
      fatigue_current = coalesce(fatigue_current, 0),
      class_id = coalesce(class_id, 'cirak')
  where armor_current is null or fatigue_current is null or class_id is null;

-- ── Index (survival query'leri için) ─────────────────────────────────────────
create index if not exists profiles_survival_idx on profiles(survival_status);

-- OdiePt V2.1 - canonical rules + coach note alignment
alter table profiles add column if not exists xp_total numeric not null default 0;

alter table workouts add column if not exists notes text default '';
alter table workouts add column if not exists primary_category text default 'mixed'
  check (primary_category in ('strength', 'movement', 'endurance', 'recovery', 'mixed'));
alter table workouts add column if not exists tags jsonb not null default '[]';
alter table workouts add column if not exists intensity text default 'moderate'
  check (intensity in ('low', 'moderate', 'high'));
alter table workouts add column if not exists source text default 'manual'
  check (source in ('telegram', 'manual'));
alter table workouts add column if not exists distance_km numeric not null default 0;
alter table workouts add column if not exists elevation_m numeric not null default 0;
alter table workouts add column if not exists class_mult numeric not null default 1;
alter table workouts add column if not exists stat_delta jsonb not null default '{}';

alter table workouts drop constraint if exists workouts_type_check;
alter table workouts add constraint workouts_type_check check (
  type in (
    'Push','Pull','Shoulder','Parkour','Akrobasi','Bacak','Yuruyus','Yürüyüş',
    'Stretching','Bisiklet','Kayak','Tırmanış','Tirmanis','Calisthenics','Gym','Koşu','Kosu','Custom'
  )
);

alter table coach_notes add column if not exists warnings jsonb not null default '[]';
alter table coach_notes add column if not exists quest_hints jsonb not null default '[]';
alter table coach_notes add column if not exists skill_progress jsonb not null default '[]';

create index if not exists workouts_profile_date_idx on workouts(profile_id, date desc);
create index if not exists coach_notes_profile_date_idx on coach_notes(profile_id, date desc, created_at desc);

-- OdiePt V3 - memory / history layer
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
create index if not exists athlete_memory_profile_idx on athlete_memory(profile_id, active, scope);

create table if not exists memory_feedback (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references profiles(id) on delete cascade,
  coach_note_id uuid references coach_notes(id) on delete set null,
  memory_id     uuid references athlete_memory(id) on delete set null,
  feedback_type text not null default 'correct',
  note          text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists memory_feedback_profile_idx on memory_feedback(profile_id, created_at desc);

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
create index if not exists body_metrics_history_profile_idx on body_metrics_history(profile_id, date desc, created_at desc);

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
create index if not exists workout_blocks_workout_idx on workout_blocks(workout_id, created_at desc);
create index if not exists workout_blocks_profile_idx on workout_blocks(profile_id, kind, created_at desc);

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
create index if not exists workout_facts_workout_idx on workout_facts(workout_id, created_at desc);
create index if not exists workout_facts_profile_idx on workout_facts(profile_id, block_kind, created_at desc);
