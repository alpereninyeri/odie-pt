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
