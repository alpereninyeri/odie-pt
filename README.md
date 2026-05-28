# OdiePt

Live: https://odie-pt.vercel.app

OdiePt artik sadece statik bir RPG karti degil. Proje su anda:
- web UI
- Supabase store
- Telegram workout ingest
- ODIE coach/memory pipeline
- site ici `Ask ODIE` question terminal

uzerinden calisan hafif bir athlete OS haline gelmis durumda.

## Stack
- Vite 5
- Vanilla JS
- Supabase
- Vercel
- Telegram Bot + WebApp
- Gemini

## Local
```bash
npm install
npm run dev
```

## Verify
```bash
npm test
npm run build
```

## Source Of Truth
Proje artik `yalnizca src/data/profile.js` ile yasamiyor.

Mevcut veri akisi:
1. `src/data/profile.js`
   Seed/fallback ve default UI shape.
2. Supabase
   Profile, workouts, coach notes, memory, ask history.
3. Telegram / site actions
   Yeni workout, body metrics, ask question gibi canli girisler.
4. Derived engines
   Stat, class, survival, quest, skill, performance, narratives.

Kisa hali:
- `profile.js` hala onemli ama tek gercek kaynak degil.
- Canli davranis icin asıl merkez `store.js + supabase-client.js + api/telegram.js + api/ask.js`.

## Main Files
```text
src/
  main.js
  styles/
    cozy-reforge.css
  assets/game/cozy-v3/
    map-layer.jpg
    cabin-room.jpg
    avatar-athlete.png
    stat-*.jpg
  components/
    workout-form.js      # dormant, P1/P5 rebind adayi
    modal.js             # dormant, bottom sheet/modal refactor adayi
    toast.js             # dormant, notification refactor adayi
    panel-coach.js
    panel-ask.js
  data/
    store.js
    profile.js
    rules.js
    engine.js
    supabase-client.js

api/
  telegram.js
  ask.js
  body-events.js
  health-import.js
  health-status.js

infra/
  supabase-schema.sql
  supabase-schema-v2.sql
  supabase-memory-v3.sql
  supabase-odie-ask-v4.sql
  supabase-rls-fix-v5.sql
  supabase-hevy-v6.sql
  supabase-ingest-events-v7.sql
  supabase-health-v7.sql
  supabase-health-rpg-v8.sql
  supabase-stat-scale-v6.sql
```

## Data Update Modes
### 1. Fast path
- Telegram bot uzerinden workout yaz
- veya site icinde manual workout form kullan
- veya site icinde Ask ODIE sorusu gonder

### 2. Seed/fallback update
`src/data/profile.js` sadece default/fallback copy veya initial seed guncellemesi icin kullan.

Bu dosyada degisiklik yapman gereken durumlar:
- yeni static achievement seed
- yeni fallback skill tree
- default copy / empty state / seed examples

## Database
Migration zinciri sira ile uygulanmali. `supabase-hevy-v6.sql` Hevy idempotency, `supabase-ingest-events-v7.sql` ingest audit, `supabase-health-v7.sql` body events, `supabase-health-rpg-v8.sql` Apple/health summary tablolarini ekler.

## Private API gates
Opsiyonel single-user token:
- server: `ODIE_APP_ACCESS_TOKEN`
- browser: `VITE_ODIE_APP_ACCESS_TOKEN`

Token set edilirse `/api/ask` ve `/api/body-events` private olur; `/api/health-status` publicte sadece redacted summary verir, token ile detay acar. Telegram icin `TELEGRAM_WEBHOOK_SECRET`, Hevy cron icin `HEVY_INTERNAL_SECRET` veya `CRON_SECRET` kullan.

## Deploy
`main` branch push -> Vercel auto deploy.

## Current Debt
- full rerender yaklasimi var
- bazi dormant componentler yeniden baglama/refactor bekliyor
- UI smoke testleri var, genis e2e Playwright kapsami hala P5
- RLS / anon public modeli daraltma bekliyor

## Goal
Kisa vadede hedef:
- ODIE daha akilli olsun
- mobile HUD daha iyi hissettirsin
- veri girisi commit ritueline daha az bagimli olsun
