# Phase 1 - ODIE Truth Engine

Snapshot: 2026-05-29

## Live Read

| Hat | Canli sonuc | Karar |
|---|---|---|
| `/api/health-status` | `schemaReady=false`, `appleStatus=apple_disabled` | Apple health yok diye okunur. |
| `/api/health-import` | `HEALTH_IMPORT_TOKEN` configured | Import kapisi var, tablo hazir degil. |
| Vercel env | `HEALTH_IMPORT_TOKEN` var, `ODIE_APP_ACCESS_TOKEN` yok | Intake prod write fail-closed kalir. |
| Supabase migrations | `supabase-health-v7.sql` ve `supabase-health-rpg-v8.sql` repo icinde var | Canlida uygulanmasi gereken halka tablo tarafidir. |
| `/api/intake` secretsiz | 401 | Dogru. Yazma kapisi token olmadan acilmaz. |
| `/api/hevy-sync` secretsiz | 401 | Dogru. Cron/webhook sirri olmadan acilmaz. |

## Implemented Guard

- `data-truth-engine.js` eklendi.
- Apple kapaliysa cached/stale health summary karar motoruna verilmez.
- `/api/health-status` public response icine redacted `truthMap` eklendi.
- Komuta pips artik Hevy / Telegram / Apple / ODIE hatlarini tek modelden okur.
- ODIE presence Apple kapaliyken uyku/kalp/hareket yok diye konusur.

## Next Decision

Phase 1'in siradaki tek implementasyon karari:

1. `ODIE_APP_ACCESS_TOKEN` ve browser token eslestirmesi prod icin ayarlanacak mi?
2. Supabase SQL Editor'da `supabase-health-v7.sql` + `supabase-health-rpg-v8.sql` canliya uygulanacak mi?
3. Apple Health bilincli kapali kalacaksa UI'da bu durum final karar olarak korunacak mi?
