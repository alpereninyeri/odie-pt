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
  style.css
  components/
    panel-coach.js
    panel-ask.js
    workout-form.js
    daily-checklist.js
  data/
    store.js
    profile.js
    rules.js
    engine.js
    supabase-client.js

api/
  telegram.js
  ask.js

infra/
  supabase-schema.sql
  supabase-schema-v2.sql
  supabase-memory-v3.sql
  supabase-odie-ask-v4.sql
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
Yeni `Ask ODIE` ledger icin su migration eklendi:
- `infra/supabase-odie-ask-v4.sql`

Bu migration uygulanmadan ask route cevap verebilir, ama soru gecmisi kalici yazilmaz.

## Deploy
`main` branch push -> Vercel auto deploy.

## Current Debt
- `src/style.css` hala buyuk ve katmanli
- full rerender yaklasimi var
- bazi schema/migration dosyalari version zinciri halinde duruyor
- UI tests yok, logic tests var

## Goal
Kisa vadede hedef:
- ODIE daha akilli olsun
- mobile HUD daha iyi hissettirsin
- veri girisi commit ritueline daha az bagimli olsun
