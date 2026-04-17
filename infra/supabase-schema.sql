-- OdiePt Supabase Şeması
-- Supabase SQL Editor'da çalıştır: https://supabase.com/dashboard → SQL Editor

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id               uuid primary key default gen_random_uuid(),
  nick             text not null default 'SenUzulme27',
  handle           text not null default '@senuzulme27',
  rank             text not null default 'Silver III',
  rank_icon        text default '🥉',
  class            text default 'Calisthenic Warrior',
  sub_class        text default 'Acrobatic Sub-Class',
  avatar           text default '🥷',
  level            int  not null default 4,
  xp_current       int  not null default 1340,
  xp_max           int  not null default 2000,
  sessions         int  not null default 52,
  total_volume_kg  numeric not null default 213000,
  total_sets       int  not null default 975,
  total_minutes    int  not null default 2678,
  stats            jsonb not null default '{"str":78,"agi":77,"end":73,"dex":68,"con":12,"sta":63}',
  streak_current   int  not null default 0,
  streak_max       int  not null default 7,
  last_workout_date date,
  last_updated     timestamptz not null default now()
);

-- Seed verisi
insert into profiles (nick) values ('SenUzulme27')
on conflict do nothing;

-- ── Workouts ──────────────────────────────────────────────────────────────────
create table if not exists workouts (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles(id) on delete cascade,
  date           date not null,
  type           text not null check (type in ('Push','Pull','Shoulder','Parkour','Akrobasi','Bacak','Yürüyüş','Stretching','Custom')),
  duration_min   int  not null default 0,
  volume_kg      numeric not null default 0,
  sets           int  not null default 0,
  highlight      text default '',
  exercises      jsonb not null default '[]',
  xp_earned      int  not null default 0,
  xp_multiplier  numeric not null default 1.0,
  has_pr         boolean not null default false,
  started_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists workouts_date_idx on workouts(date desc);
create index if not exists workouts_type_idx on workouts(type);

-- ── Daily Logs ────────────────────────────────────────────────────────────────
create table if not exists daily_logs (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id) on delete cascade,
  date         date not null,
  water_ml     int  not null default 0,
  sleep_hours  numeric not null default 0,
  steps        int  not null default 0,
  mood         int  not null default 3 check (mood between 1 and 5),
  created_at   timestamptz not null default now(),
  unique(profile_id, date)
);

-- ── Achievements ──────────────────────────────────────────────────────────────
create table if not exists achievements (
  id           text primary key,
  profile_id   uuid references profiles(id) on delete cascade,
  unlocked     boolean not null default false,
  unlocked_at  timestamptz,
  icon         text not null default '🏆',
  name         text not null,
  desc         text not null default '',
  req          text not null default '',
  xp_reward    int  not null default 0
);

-- ── Badges ───────────────────────────────────────────────────────────────────
create table if not exists badges (
  id           text primary key,
  profile_id   uuid references profiles(id) on delete cascade,
  earned_at    timestamptz,
  badge_type   text not null default 'achievement',
  icon         text not null default '🏅',
  name         text not null,
  rarity       text not null default 'common' check (rarity in ('common','rare','epic','legendary','hidden')),
  locked       boolean not null default true
);

-- Seed badges
insert into badges (id, badge_type, icon, name, rarity, locked) values
  ('first_blood',       'achievement', '🩸', 'İlk Kan',            'common',    false),
  ('parkour_initiate',  'achievement', '🏃', 'Parkour Başlangıcı', 'common',    false),
  ('muscle_up',         'achievement', '💫', 'Muscle-Up Üstadı',   'epic',      false),
  ('bench_60',          'achievement', '🏋️','Bench 60kg',          'rare',      false),
  ('streak_3',          'streak',      '🔥', 'Ateşlendi',          'common',    false),
  ('streak_7',          'streak',      '🔥🔥','Yanıyor',           'rare',      true),
  ('streak_14',         'streak',      '💀', 'Durdurulamaz',       'epic',      true),
  ('streak_30',         'streak',      '⚡', 'Efsane',             'legendary', true),
  ('iron_week',         'achievement', '⚙️', 'Iron Week',          'epic',      true),
  ('pr_hunter',         'achievement', '🎯', 'PR Avcısı',          'rare',      true),
  ('core_awakening',    'achievement', '⚡', 'Core Uyanışı',       'rare',      true),
  ('bench_70',          'achievement', '🔩', 'Bench 70kg',         'epic',      true),
  ('centurion',         'achievement', '🛡️','Centurion',           'legendary', true),
  ('volume_250k',       'achievement', '⚖️', 'Volume King',        'legendary', true),
  ('consistency_king',  'achievement', '👑', 'Consistency King',   'epic',      true),
  ('hidden_early_bird', 'hidden',      '🌅', '???',                'hidden',    true),
  ('hidden_midnight',   'hidden',      '🌙', '???',                'hidden',    true)
on conflict(id) do nothing;

-- ── Coach Notes ───────────────────────────────────────────────────────────────
create table if not exists coach_notes (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id) on delete cascade,
  workout_id   uuid references workouts(id) on delete set null,
  date         date not null default current_date,
  sections     jsonb not null default '[]',
  xp_note      text default '',
  created_at   timestamptz not null default now()
);

-- ── Quests ───────────────────────────────────────────────────────────────────
create table if not exists quests (
  id            text primary key,
  profile_id    uuid references profiles(id) on delete cascade,
  quest_type    text not null default 'daily' check (quest_type in ('daily','weekly','challenge')),
  period_start  date not null default current_date,
  period_end    date not null default current_date,
  name          text not null,
  desc          text not null default '',
  icon          text not null default '🎯',
  progress      int  not null default 0,
  total         int  not null default 1,
  reward        text not null default '',
  xp_reward     int  not null default 0,
  done          boolean not null default false,
  urgent        boolean not null default false
);

-- ── Stats History ─────────────────────────────────────────────────────────────
create table if not exists stats_history (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id) on delete cascade,
  date         date not null default current_date,
  str          int  not null default 0,
  agi          int  not null default 0,
  end_         int  not null default 0,
  dex          int  not null default 0,
  con          int  not null default 0,
  sta          int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists stats_history_date_idx on stats_history(date desc);

-- ── PRs (Personal Records) ────────────────────────────────────────────────────
create table if not exists prs (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles(id) on delete cascade,
  exercise_name  text not null,
  weight_kg      numeric,
  reps           int,
  duration_sec   int,
  score          numeric not null default 0,
  date           date not null,
  created_at     timestamptz not null default now(),
  unique(profile_id, exercise_name)
);

-- ── Realtime enable ───────────────────────────────────────────────────────────
-- Supabase Dashboard > Database > Replication > profiles ve workouts tablolarını aç
-- Veya:
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table workouts;

-- ── Row Level Security (tek kullanıcı — basit RLS) ───────────────────────────
-- Şu aşamada RLS devre dışı (tek kullanıcı, anon key yeterli)
-- Gelecekte auth.uid() ile kısıtla

-- OdiePt V2.1 - canonical rules + coach note alignment
alter table profiles add column if not exists armor_current int not null default 100;
alter table profiles add column if not exists fatigue_current int not null default 0;
alter table profiles add column if not exists consecutive_heavy int not null default 0;
alter table profiles add column if not exists injury_until date;
alter table profiles add column if not exists survival_status text not null default 'healthy';
alter table profiles add column if not exists class_id text default 'cirak';
alter table profiles add column if not exists total_km numeric not null default 0;
alter table profiles add column if not exists xp_total numeric not null default 0;

alter table workouts add column if not exists notes text default '';
alter table workouts add column if not exists primary_category text default 'mixed';
alter table workouts add column if not exists tags jsonb not null default '[]';
alter table workouts add column if not exists intensity text default 'moderate';
alter table workouts add column if not exists source text default 'manual';
alter table workouts add column if not exists distance_km numeric not null default 0;
alter table workouts add column if not exists elevation_m numeric not null default 0;
alter table workouts add column if not exists class_mult numeric not null default 1;
alter table workouts add column if not exists survival_status text default 'healthy';
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
