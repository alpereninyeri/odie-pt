-- OdiePt V4 - site icin ayrik soru hafizasi
create table if not exists odie_questions (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references profiles(id) on delete cascade,
  source        text not null default 'web'
    check (source in ('web', 'telegram', 'admin')),
  question      text not null,
  answer        text not null default '',
  response_json jsonb not null default '{}'::jsonb,
  tags          jsonb not null default '[]'::jsonb,
  model         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists odie_questions_profile_created_idx
  on odie_questions(profile_id, created_at desc);
