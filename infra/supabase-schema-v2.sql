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
