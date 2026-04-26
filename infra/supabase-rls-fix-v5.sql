-- OdiePt V5 — RLS fix
-- Single-user app using anon key; other tables are RLS-off.
-- These tables had RLS enabled with no policies, so every insert failed
-- (workout_blocks/workout_facts/athlete_memory/memory_feedback/body_metrics_history).
alter table if exists public.workout_blocks       disable row level security;
alter table if exists public.workout_facts        disable row level security;
alter table if exists public.athlete_memory       disable row level security;
alter table if exists public.memory_feedback      disable row level security;
alter table if exists public.body_metrics_history disable row level security;
alter table if exists public.odie_questions       disable row level security;
