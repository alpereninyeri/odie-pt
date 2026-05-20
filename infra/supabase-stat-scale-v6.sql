-- OdiePt stat scale calibration v6
-- Supabase SQL Editor'da calistir.

alter table profiles
  add column if not exists calibration jsonb not null default '{}';

comment on column profiles.calibration is
  'One-time stat calibration answers and metadata. Workout-derived stats remain the source of truth.';
