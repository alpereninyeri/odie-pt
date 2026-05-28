# OdiePt - Working Notes

Bu repo artik iki moda sahip:

## 1. Seed mode
`src/data/profile.js`
- fallback UI data
- default copy
- seed achievements / skills / empty state

## 2. Live mode
Canli veri akisi:
- `src/data/store.js`
- `src/data/supabase-client.js`
- `api/telegram.js`
- `api/ask.js`

Yani yeni workout, memory, coach note, ask history gibi seyler her zaman `profile.js` uzerinden gitmez.

## What To Touch First
### UI
- `src/main.js`
- `src/styles/cozy-reforge.css`
- `src/assets/game/cozy-v3/*`
- `src/components/workout-form.js`, `modal.js`, `toast.js`, `panel-ask.js`, `panel-coach.js` dormant/rebind adaylari

### Data / derived logic
- `src/data/rules.js`
- `src/data/engine.js`
- `src/data/store.js`
- `src/data/semantic-profile.js`

### Server routes
- `api/telegram.js`
- `api/ask.js`
- `api/hevy-webhook.js` (Hevy yeni workout)
- `api/hevy-sync.js`    (gunluk delta cron)
- `api/hevy-backfill.js` (manuel tarihsel backfill)
- `api/health-import.js` (Apple Health Shortcut import)
- `api/health-status.js` (redacted public status + tokenli detay)
- `api/body-events.js` (tokenli body event read/write)

## Current User Flows
### Workout logging
- Telegram message
- Hevy app (webhook + cron delta)
- site icinde manual workout form

### Recovery logging
- daily checklist

### Coaching
- coach feed
- ask terminal
- memory feedback

## If You Need To Add Schema
Infra klasorune yeni migration ekle.
Mevcut zincir:
- `supabase-schema.sql`
- `supabase-schema-v2.sql`
- `supabase-memory-v3.sql`
- `supabase-odie-ask-v4.sql`
- `supabase-rls-fix-v5.sql`
- `supabase-hevy-v6.sql`  (Hevy: external_source/external_id/raw_external + hevy_sync_state)
- `supabase-ingest-events-v7.sql`
- `supabase-health-v7.sql`
- `supabase-health-rpg-v8.sql`
- `supabase-stat-scale-v6.sql`

## Hevy Entegrasyonu (V6)
- Webhook payload'i sadece `{ id }` — biz `lib/hevy/client.js` ile detayi cekeriz.
- `lib/hevy/normalize.js`: Hevy workout -> OdiePt session shape; type'i egzersiz adlarindan tahmin eder.
- `lib/hevy/persist.js`: telegram.js ile ayni XP / survival / stat / profile pipeline'ini calistirir ve yeni Hevy kaydi icin coach note uretir. Backfill tarihsel importta coach'u kapatir. Idempotency external_id index'inden gelir.
- Cron: `vercel.json` -> `/api/hevy-sync` her gun 03:00 UTC. Webhook gercek zamanli, cron guvence.
- Env vars: `HEVY_API_KEY`, `HEVY_WEBHOOK_SECRET`, `HEVY_INTERNAL_SECRET` veya `CRON_SECRET` (bkz. `.env`).

## Private API Gates
- `ODIE_APP_ACCESS_TOKEN` set edilirse `/api/ask` ve `/api/body-events` token ister.
- Browser tarafinda ayni token `VITE_ODIE_APP_ACCESS_TOKEN` ile gonderilir.
- `/api/health-status` publicte redacted summary verir; token ile debug detay acilir.
- Telegram webhook icin `TELEGRAM_WEBHOOK_SECRET` kullan.

## Verification
Her anlamli degisiklikten sonra:
```bash
npm test
npm run build
```

## Current Debt To Prefer
1. Componentleri tekrar baglama ya da silme
2. full rerender maliyeti
3. docs drift
4. RLS / anon public guvenlik daraltmasi
