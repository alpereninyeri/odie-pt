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
Hevy Public API
        ↓
api/snapshot.js (sunucu tarafı, 5 dk cache)
        ↓
normalize + stat / XP / rank / bölge hesabı
        ↓
src/data/dashboard-store.js
        ↓
Durum / Bölgeler / Seanslar
```

- Tarayıcı Hevy API'ye doğrudan bağlanmaz; API anahtarı yalnızca sunucuda kalır.
- Üretim dashboardu veriyi doğrudan Hevy API'den okur; Supabase, webhook ve cron gerekmez.
- Dashboarddaki “Hevy’yi yenile” butonu sunucu cache'ini kontrollü biçimde tazeler.
- API yalnızca dashboardun kullandığı alanları döndürür; Hevy notları ve ham payload tarayıcıya gönderilmez.
- Varsayılan yayın modeli salt okunur public özettir. İstenirse `ODIE_APP_ACCESS_TOKEN` eklenerek endpoint kilitlenebilir.
- Hevy hattı Gemini, coach veya başka bir model çağrısı yapmaz.

## Gerekli production env

- `HEVY_API_KEY`
- İsteğe bağlı: `ODIE_APP_ACCESS_TOKEN`

Supabase, Gemini, Apple Health, Telegram, webhook ve cron değişkenleri mevcut ürün için gerekli değildir.

## Yerel çalışma

```powershell
npm.cmd install
npm.cmd run dev
```

Yerelde `HEVY_API_KEY` yoksa güvenli demo veri gösterilir. Anahtar varsa gerçek Hevy verisi otomatik yüklenir.

## Doğrulama

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run release:check
npm.cmd run hevy:direct:check
```

Canlı sözleşme kontrolleri:

```powershell
npm.cmd run vercel:env:check
npm.cmd run live:smoke
```

## Önemli dosyalar

- `src/main.js` — üç ekranlı UI ve etkileşimler
- `src/styles/cozy-reforge.css` — responsive training-console tasarım sistemi
- `src/data/dashboard-model.js` — 7/28 günlük istatistikler, ranklar ve bölge açıkları
- `src/data/dashboard-store.js` — demo/cache/live snapshot durumu
- `src/data/body-map-engine.js` — Hevy egzersizlerinden bölge yükü ve ihmal sinyali
- `api/snapshot.js` — cache'li, isteğe bağlı token korumalı Hevy dashboard paketi
- `lib/hevy/dashboard-snapshot.js` — pagination, normalizasyon, XP/rank ve güvenli public payload

## Deploy

`main` dalına push Vercel production deployunu tetikler. “Çalışıyor” demek için yalnızca local build yeterli değildir; deploydan sonra `live:smoke` ve masaüstü/mobil browser QA tekrar çalıştırılmalıdır.
