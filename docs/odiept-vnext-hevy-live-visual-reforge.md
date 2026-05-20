# OdiePt vNext - Hevy Live + Visual Reforge

## Current decision

Hevy API stays as the main live workout source. OdiePt should not clone Hevy logging; it should read Hevy, Telegram and manual entries, then produce the next training decision, RPG state, recovery risk and ODIE command.

## Schema order

Apply migrations in this order for a fresh Supabase project:

1. `infra/supabase-schema.sql`
2. `infra/supabase-schema-v2.sql`
3. `infra/supabase-memory-v3.sql`
4. `infra/supabase-odie-ask-v4.sql`
5. `infra/supabase-rls-fix-v5.sql`
6. `infra/supabase-hevy-v6.sql`
7. `infra/supabase-ingest-events-v7.sql`

## Hevy reliability

- `api/hevy-webhook.js` is the fast path.
- `api/hevy-sync.js` is the daily safety path through `/v1/workouts/events`.
- `api/hevy-backfill.js` is the historical import path.
- `workouts.external_source + external_id` remains the idempotency boundary.
- `ingest_events` records received, processed, skipped and failed Hevy events.

## Visual reforge scope

- Keep the current RPG identity.
- Improve Today first: Hevy live status, next session command, readiness, source mix and last sync.
- ODIE panel gets a tactical header so it feels like the coach is driving the next action, not just a chat terminal.
- Legacy CSS files that are not imported should stay out of active styling until a later cleanup pass.

## Security follow-up

RLS is still intentionally loose in the current single-user setup. The next hardening pass should move browser write paths behind server routes and validate Telegram Mini App `initData` server-side before enabling profile-scoped RLS.
