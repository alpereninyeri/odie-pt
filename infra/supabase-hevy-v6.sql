-- OdiePt V6 — Hevy entegrasyonu
-- Workouts tablosuna external kaynak alanlari + idempotency + sync cursor.
-- Supabase SQL Editor'da calistir (mevcut sema uzerine uygulanir).

-- ── Workouts: external kaynak alanlari ───────────────────────────────────────
alter table workouts add column if not exists external_source text;
alter table workouts add column if not exists external_id     text;
alter table workouts add column if not exists raw_external    jsonb;

-- Idempotency: ayni external workout iki kez yazilmasin (webhook + cron cakisinca)
create unique index if not exists workouts_external_uidx
  on workouts(external_source, external_id)
  where external_source is not null and external_id is not null;

-- 'hevy' kaynagini source check constraint'ine ekle
alter table workouts drop constraint if exists workouts_source_check;
alter table workouts add constraint workouts_source_check check (
  source in ('telegram','manual','hevy')
);

-- ── Hevy sync cursor / durum tablosu ────────────────────────────────────────
create table if not exists hevy_sync_state (
  profile_id     uuid primary key references profiles(id) on delete cascade,
  events_since   timestamptz,
  last_event_id  text,
  last_synced_at timestamptz,
  last_error     text,
  updated_at     timestamptz not null default now()
);

-- Single-user app: RLS kapali (diger memory tablolari gibi).
alter table if exists public.hevy_sync_state disable row level security;
