-- OdiePt V7 - Body events + Apple Health shortcut import
-- Supabase SQL Editor'da mevcut sema uzerine calistir.

create table if not exists body_events (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles(id) on delete cascade,
  kind                text not null default 'injury'
    check (kind in ('injury','pain','tightness','rehab','note')),
  region              text not null default 'core',
  side                text not null default 'unknown'
    check (side in ('left','right','both','unknown')),
  severity            int not null default 3
    check (severity between 1 and 5),
  recovery_percent    int not null default 0
    check (recovery_percent between 0 and 100),
  expected_clear_at   date,
  status              text not null default 'active'
    check (status in ('active','watch','rehab','resolved','archived')),
  note                text not null default '',
  source              text not null default 'manual',
  odie_interpretation jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists body_events_profile_status_idx
  on body_events(profile_id, status, created_at desc);

create index if not exists body_events_region_idx
  on body_events(region, status);

alter table workouts add column if not exists external_source text;
alter table workouts add column if not exists external_id     text;
alter table workouts add column if not exists raw_external    jsonb;

create unique index if not exists workouts_external_uidx
  on workouts(external_source, external_id)
  where external_source is not null and external_id is not null;

alter table workouts drop constraint if exists workouts_source_check;
alter table workouts add constraint workouts_source_check check (
  source in ('telegram','manual','hevy','apple_health')
);

alter table if exists public.body_events disable row level security;

insert into body_events (
  profile_id,
  kind,
  region,
  side,
  severity,
  recovery_percent,
  expected_clear_at,
  status,
  note,
  source,
  odie_interpretation
)
select
  p.id,
  'injury',
  'wrist',
  'unknown',
  3,
  70,
  current_date + 6,
  'active',
  'Bilek kas temelli sakatlik: agir grip, bar, handstand ve sert push 6 gun temkinli.',
  'seed_migration',
  '{"tone":"temkin","summary":"Bilek: %70 toparlandi, 6 gun temkin.","locks":"Agir grip, bar, handstand, sert push ve ani landing yok.","free":"Yuruyus, alt govde, core kontrol ve nazik bilek mobilitesi serbest.","command":"Bilek temkinde: grip ve sert push kilitli, hareket temiz ve dusuk riskli kalsin."}'::jsonb
from profiles p
where p.nick = 'SenUzulme27'
  and not exists (
    select 1
    from body_events b
    where b.profile_id = p.id
      and b.region = 'wrist'
      and b.status in ('active','watch','rehab')
  )
limit 1;

do $$
begin
  alter publication supabase_realtime add table body_events;
exception
  when duplicate_object then null;
end $$;
