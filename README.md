# OdiePt

Live: https://odie-pt.vercel.app

OdiePt artik sadece statik bir RPG karti degil. Proje su anda:
- Komuta / Harita / ODIE tabli cozy-v4 oyun UI
- Supabase store
- Telegram + Hevy workout ingest
- ODIE coach/memory pipeline
- ODIE intake preview/confirm kayit akisi

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
  assets/game/cozy-v4/
    command-bg-*.jpg
    world-map-*.jpg
    odie-room-*.jpg
    nav-*.png
    zone-*.png
    reward-*.png
    badge-*.png
    info-*.png
  components/
    workout-form.js      # dormant/dev-only; production write ODIE intake
    modal.js             # dormant, bottom sheet/modal refactor adayi
    toast.js             # dormant, notification refactor adayi
    panel-coach.js
    panel-ask.js
  data/
    store.js
    data-truth-engine.js
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
- Hevy app uzerinden seans kaydet
- Telegram bot uzerinden workout yaz
- veya ODIE tabinda dogal dille soyle; preview kartini onaylayinca yazar
- Ask-only sorular ODIE soru/cevap akisi olarak kalir

### 2. Seed/fallback update
`src/data/profile.js` sadece default/fallback copy veya initial seed guncellemesi icin kullan.

Bu dosyada degisiklik yapman gereken durumlar:
- yeni static achievement seed
- yeni fallback skill tree
- default copy / empty state / seed examples

## Database
Migration zinciri sira ile uygulanmali. `supabase-hevy-v6.sql` Hevy idempotency, `supabase-ingest-events-v7.sql` ingest audit, `supabase-health-v7.sql` body events, `supabase-health-rpg-v8.sql` Apple/health summary tablolarini ekler.

## Truth Engine
`src/data/data-truth-engine.js` Hevy, Telegram, Apple ve ODIE intake durumunu tek modele indirir. Apple health semasi kapaliysa stale health summary kullanilmaz; Komuta/ODIE Apple'i "kapali" okuyup uyku/kalp/hareket varmis gibi davranmaz.

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
- UI smoke testleri ve Playwright e2e kapsami aktif tutulur
- RLS / anon public modeli daraltma bekliyor

## Goal
Kisa vadede hedef:
- ODIE dogal dille kayit alsin
- mobile ilk ekran oynanabilir kalsin
- veri girisi her gun manuel guncelleme zorunluluguna bagli olmasin
