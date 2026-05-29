# CODEX BRIEF - OdiePt ODIE Intake + Cozy World Game Update

> Bu belge OdiePt'nin yeni oyun dongusunu anlatan guncel uygulama brief'idir.
> Amaç: pasif dashboard hissini silip ODIE ile kayit alan, Harita'da veriyle ilerleyen, infografiklerle motive eden Turkce RPG takip uygulamasi.
> Belge tarihi: 2026-05-29.

---

## Kilitli Yön

- Alt nav sadece uc sekme: **Komuta**, **Harita**, **ODIE**.
- **Defter** kullanici yuzeyinden kalkti. Eski manuel formlar ilk release'te fallback/dev-only kalabilir.
- Ana kayit davranisi: kullanici ODIE'ye dogal dille soyler, ODIE once kayit karti cikarir, kullanici onaylayinca yazar.
- Teknik guven dili yasak: `confidence`, `evidence`, `source`, `schema`, `migration`, `endpoint`, `API`, `JSON`, `payload`, `cache`, `fallback`.
- Eski tema CSS'leri geri getirilmeyecek: `riftline.css`, `odie-ui.css`, `cozy-rpg/mobile.css`.
- Assetler korunur; yeni oyun assetleri `src/assets/game/cozy-v4/` altindadir.

---

## Aktif Ajan Rolleri

| Ajan | Rol | Sorumluluk |
|---|---|---|
| Agent A | Product Director | Komuta -> Harita -> ODIE oyun dongusunu korur. |
| Agent B | Gameplay Designer | gorev, odul, unlock, streak, motivasyon dili ve map node mantigi. |
| Agent C | UI/Game Artist | cozy-v4 asset pack, ikon ailesi, harita/infografik gorsel tutarliligi. |
| Agent D | Frontend Engineer | `main.js`, CSS, selector kontratlari, responsive davranis. |
| Agent E | Server Engineer | `/api/intake`, parser, preview/confirm, auth fail-closed. |
| Agent F | QA/Release Guard | test, build, browser QA, staging kapsami, deploy sonrasi live QA. |

---

## Faz 1 - ODIE Intake

### Kullanici Akisi

1. Kullanici ODIE sekmesine gider.
2. "dun gogus girdim", "omuz agriyor", "7 saat uyudum", "bugun ne yapayim?" gibi dogal mesaj yazar.
3. `/api/intake` `mode: "preview"` ile mesaj kayit kartina doner.
4. Kullanici onaylarsa `mode: "confirm"` Supabase'e yazar.
5. Soruysa `/api/ask` cevabi korunur.

### Kayit Turleri

- `workout`
- `daily_log`
- `body_event`
- `body_metric`
- `question`
- `needs_clarification`

### Kabul Kriteri

- Belirsiz metin yazmaz, netlestirme ister.
- Preview yazmaz; confirm yazar.
- Workout yazarsa `exercises`, `sets`, `volumeKg`, XP/stat/PR sinyali bos kalmaz.
- Production token yoksa write endpoint fail-closed 401 doner.

---

## Faz 2 - Komuta ve Turkce Oyun Dili

### Komuta

- Ilk ekran oynanabilir kalir: avatar, Seviye/XP, 6 stat, enerji, siradaki gorev, odul preview ve tek ana CTA.
- CTA: **ODIE'ye söyle**.
- Eski dil temizlenir:
  - `Mission Loop` -> `Görev Döngüsü`
  - `HUD` -> `Komuta`
  - `LVL` -> `Seviye`
  - `LOCKED` -> `Kilitli`
  - `UNLOCKED` -> `Açık`

### Rastgele Gibi Hissettiren Dili

- Gercek random yok.
- Gun + quest id ile deterministik flavor secilir.
- Ayni gun ayni gorev metni sabit kalir; baska gun taze hisseder.

---

## Faz 3 - World Map

### Zone'lar

- **Güç Ocağı**
- **Parkur Avlusu**
- **Toparlanma Kulübesi**
- **Dayanıklılık Yolu**
- **Beceri Kapısı**
- **Vücut Demirhanesi**

### Node Mantigi

- Aktif görev node'u
- Riskli bölge node'u
- Unlock gate
- Hareket hattı
- Reward node
- Recovery gate

### Kabul Kriteri

- `world-map-board`, `world-node`, `active-quest-node` selectorlari vardir.
- Node'a tiklaninca kisa oyun diliyle bottom sheet acilir.
- Harita bos dekor degil, aktif veri modelinden uretilir.

---

## Faz 4 - Infografikler

### Yeni Paneller

- XP kırılımı
- Vücut baskısı
- Unlock merdiveni
- Stat rütbe ilerlemesi
- Recovery / PR kapısı

### Davranis

- Heatmap, volume, radar, bar row, quest, reward, stat, PR, badge, warning ve progress lane tiklanabilir aciklama alir.
- Aciklama kisa olur; teknik terim gostermez.

---

## Faz 5 - Asset Pass

### Cozy-v4 Pack

Konum: `src/assets/game/cozy-v4/`

- `world-map.jpg`
- `odie-portrait.jpg`
- `avatar-athlete.png`
- `stat-str.png`
- `stat-agi.png`
- `stat-end.png`
- `stat-dex.png`
- `stat-con.png`
- `stat-sta.png`
- `route-marker.png`
- `reward-xp.png`
- `reward-gift.png`
- `level-badge.png`

### Kurallar

- ImageGen assetlerinde gorsele yazi gomulmez.
- Metin hatasi veya stil drift'i olursa manuel/Python duzeltme degil, ImageGen ile yeniden uretim.
- Mobil performans icin import edilen assetler optimize edilir.

---

## QA ve Deploy

### Otomatik

```bash
npm.cmd test
npm.cmd run build
```

### Browser QA

- 320x568
- 390x844
- 414x896
- 768x1024
- 1440x900

Kontroller:

- Komuta/Harita/ODIE ilk viewport okunur.
- Yatay overflow yok.
- World Map 6 node gosterir.
- Node/detail sheet acilir.
- Tab gecince acik detail kapanir.
- ODIE textarea ve preview/confirm yuzeyi gorunur.

### Live QA

- `/api/next-session` 200
- `/api/health-status` public redacted
- `/api/hevy-sync` secretsiz 401
- `/api/intake` secretsiz 401

---

## Sonraki Fazlar

- Apple Health native write-back yok; read-only health summary readiness'a katkı verir.
- Supabase RLS/anon daraltması ayrı migration fazı.
- `main.js` panel bazlı component/diff yapısına daha sonra bölünecek.
- ODIE intake parser daha zengin spor diline açılacak: superset, RPE, tempo, sakatlık şiddeti, dinlenme tahmini.
