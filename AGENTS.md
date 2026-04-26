# OdiePt — Spor Karakter Karti

@senuzulme27'nin fitness takip uygulamasi. RPG karakter karti formatinda spor verisi gosterir.

## Canli URL
**https://odie-pt.vercel.app**

## Iki Mod (CLAUDE.md ile ayni)

### Seed mode — `src/data/profile.js`
- fallback UI verisi
- default copy
- baslangic stat / skill / quest tanimlari

### Live mode — Supabase + API
- `src/data/store.js` — state + LS cache + realtime sub
- `src/data/supabase-client.js` — DB erisimi
- `api/telegram.js` — Telegram webhook + Gemini parse + coach
- `api/ask.js` — soru/cevap

Yeni workout, mood, daily log, coach note, ask history → her zaman **canli mod** uzerinden gider.
`profile.js`'i sadece seed/varsayilan icin guncelle.

## Deploy
`main` branch'e push -> Vercel ~30sn icinde deploy.

## Veri Akislari
- **Workout logging**: Telegram mesaji veya site icindeki workout-form modali.
- **Recovery logging**: Daily checklist (su/uyku/adim/mood).
- **Coaching**: Coach feed (seans-sonu) + Ask terminal (soru-cevap).
- **Memory feedback**: Coach panel'inden "DOGRU/YANLIS/ESKI/TONU IYI" butonlariyla.

## Schema Migration Ekleme
Yeni migration dosyasini `infra/`'a ekle:
- `supabase-schema.sql`
- `supabase-schema-v2.sql`
- `supabase-memory-v3.sql`
- `supabase-odie-ask-v4.sql`
- `supabase-rls-fix-v5.sql`

## Verification
Anlamli her degisiklikten sonra:
```bash
npm test
npm run build
```

## Mevcut Tech Debt (oncelik sirali)
1. CSS katmanlarini sadelestir (5 ayri override katmani var).
2. Full re-render maliyeti (panel-bazli diff cache).
3. Dormant component varsa bagla ya da sil.
4. RLS off + anon key public — guvenlik daraltmasi.
