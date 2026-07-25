# OdiePt

Hevy verisini sade, oyunlaştırılmış bir spor dashboarduna çeviren kişisel training console.

Canlı adres: [odie-pt.vercel.app](https://odie-pt.vercel.app)

## Ürün kapsamı

OdiePt artık **Hevy-only** bir üründür. Ana uygulamada AI, sohbet, coach, manuel günlük, dünya haritası veya sosyal katman yoktur.

Üç ekran bulunur:

1. **Durum** — son 7/28 gün, seans, aktif gün, hacim, süre, devam zinciri, XP ve stat rankları.
2. **Bölgeler** — Hevy egzersizlerinden hesaplanan kas yükü, eksik kalan bölgeler, son temas ve eklem risk sinyali.
3. **Seanslar** — Hevy antrenman geçmişi, egzersiz kırılımı ve dönem dağılımı.

Ham `0-100` skorlar ikincil detaydır. Ana okuma rank, ritim, açık bölge ve somut kayıt üzerinden yapılır.

## Veri akışı

```text
Hevy webhook / günlük cron
        ↓
api/hevy-webhook.js + api/hevy-sync.js
        ↓
Supabase workouts + profile + hevy_sync_state
        ↓
api/snapshot.js
        ↓
src/data/dashboard-store.js
        ↓
Durum / Bölgeler / Seanslar
```

- Tarayıcı Supabase'e doğrudan bağlanmaz.
- Kişisel snapshot `ODIE_APP_ACCESS_TOKEN` ile korunur.
- Dashboarddaki “Hevy’yi yenile” butonu aynı erişim anahtarıyla güvenli delta sync tetikler.
- Anahtar yoksa ekran açıkça **Demo modu** olarak çalışır; demo veri canlıymış gibi sunulmaz.
- Hevy kayıt hattı Gemini, coach veya başka bir model çağrısı yapmaz.

## Gerekli production env

- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` veya `SUPABASE_SERVICE_KEY`
- `ODIE_APP_ACCESS_TOKEN`
- `HEVY_API_KEY`
- `HEVY_WEBHOOK_SECRET`
- `HEVY_INTERNAL_SECRET` veya `CRON_SECRET`
- İsteğe bağlı: `ODIEPT_PROFILE_ID`

`GEMINI_API_KEY`, Apple Health ve Telegram değişkenleri mevcut ürün için gerekli değildir.

## Yerel çalışma

```powershell
npm.cmd install
npm.cmd run dev
```

Yerelde erişim anahtarı verilmezse demo veri gösterilir.

## Doğrulama

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run release:check
```

Canlı sözleşme kontrolleri:

```powershell
npm.cmd run db:contract:check
npm.cmd run vercel:env:check
npm.cmd run live:smoke
```

## Önemli dosyalar

- `src/main.js` — üç ekranlı UI ve etkileşimler
- `src/styles/cozy-reforge.css` — responsive training-console tasarım sistemi
- `src/data/dashboard-model.js` — 7/28 günlük istatistikler, ranklar ve bölge açıkları
- `src/data/dashboard-store.js` — demo/cache/live snapshot durumu
- `src/data/body-map-engine.js` — Hevy egzersizlerinden bölge yükü ve ihmal sinyali
- `api/snapshot.js` — küçük, token korumalı dashboard paketi
- `api/hevy-sync.js` — cron veya dashboard üzerinden delta senkron
- `api/hevy-webhook.js` — yeni Hevy workout webhooku

## Deploy

`main` dalına push Vercel production deployunu tetikler. “Çalışıyor” demek için yalnızca local build yeterli değildir; deploydan sonra `live:smoke` ve masaüstü/mobil browser QA tekrar çalıştırılmalıdır.
