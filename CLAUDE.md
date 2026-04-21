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

## Current User Flows
### Workout logging
- Telegram message
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
