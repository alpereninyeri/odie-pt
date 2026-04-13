# OdiePt — Fitness RPG Card

**Live:** https://odie-pt.vercel.app

RPG karakter kartı formatında fitness takip uygulaması. [@senuzulme27](https://github.com/senuzulme27) için.

## Stack
- Vite 5 (build tool)
- Vanilla JS — framework yok
- Vercel (hosting, GitHub'a bağlı auto-deploy)

## Local Development
```bash
npm install
npm run dev
```

## Deploy
`main` branch'e push → Vercel otomatik ~30sn içinde deploy eder.

## Veri Güncelleme
Tüm kullanıcı verisi tek dosyada: `src/data/profile.js`

Antrenman sonrası güncelleme:
1. `src/data/profile.js` düzenle
2. `git add src/data/profile.js && git commit -m "workout: özet" && git push`
3. https://odie-pt.vercel.app otomatik güncellenir

## Dosya Yapısı
```
src/
  main.js              — app boot, tab sistemi
  style.css            — tüm stiller
  data/
    profile.js         — TÜM kullanıcı verisi buraya
  components/
    header.js          — avatar, XP bar, rank
    modal.js           — stat/perf detay modalleri
    panel-stats.js     — ana stat grid
    panel-muscles.js   — kas dengesi + accordion
    panel-skills.js    — skill tree
    panel-health.js    — aktivite halkaları + sağlık
    panel-quests.js    — görevler + başarılar + log
```
