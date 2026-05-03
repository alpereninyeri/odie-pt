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
- `src/style.css`
- `src/components/*`

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

## Hevy Entegrasyonu (V6)
- Webhook payload'i sadece `{ id }` — biz `lib/hevy/client.js` ile detayi cekeriz.
- `lib/hevy/normalize.js`: Hevy workout -> OdiePt session shape; type'i egzersiz adlarindan tahmin eder.
- `lib/hevy/persist.js`: telegram.js ile ayni XP / survival / stat / profile pipeline'ini calistirir, ama coach yorumu uretmez (sessiz). Idempotency external_id index'inden gelir.
- Cron: `vercel.json` -> `/api/hevy-sync` her gun 03:00 UTC. Webhook gercek zamanli, cron guvence.
- Env vars: `HEVY_API_KEY`, `HEVY_WEBHOOK_SECRET`, `HEVY_INTERNAL_SECRET` (bkz. `.env`).

## Verification
Her anlamli degisiklikten sonra:
```bash
npm test
npm run build
```

## Current Debt To Prefer
1. CSS sadeleme
2. full rerender maliyeti
3. docs drift
4. dormant componentleri ya bagla ya sil
