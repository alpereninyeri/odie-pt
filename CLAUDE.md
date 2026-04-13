# OdiePt — Spor Karakter Kartı

Bu proje, @senuzulme27'nin fitness takip uygulamasıdır. RPG karakter kartı formatında spor verilerini gösterir.

## Canlı URL
**https://odie-pt.vercel.app**

## Proje Yapısı
- `src/data/profile.js` — TÜM VERİ BURADADIR. Güncelleme yaparken sadece bu dosyayı değiştir.
- `src/components/` — UI bileşenleri (genellikle dokunma)

## Deploy Akışı (GitHub → Vercel Otomatik)

`main` branch'e her push → Vercel otomatik deploy (~30sn).

### Standart Güncelleme (PC'de Claude Code ile):
1. `src/data/profile.js` güncelle
2. Push et:
   ```bash
   git add src/data/profile.js
   git commit -m "workout: <özet>"
   git push
   ```
3. https://odie-pt.vercel.app otomatik güncellenir

### Mobil Claude Workflow:

**Seçenek A — GitHub Web Editor (önerilen):**
1. Mobilde `github.com/[USERNAME]/odie-pt` → `src/data/profile.js`
2. Kalem ikonuna tıkla → düzenle → "Commit changes"
3. Vercel ~30sn içinde deploy eder

**Seçenek B — PC Claude Code:**
1. Mobil Claude'da antrenmanı anlat
2. PC'de bu klasörde `claude` aç
3. "Mobilde anlattım, profile.js güncelle ve push et"

### Emergency Manuel Deploy (git yoksa):
```bash
npm run build && vercel --prod --yes
```

## profile.js Güncelleme Kılavuzu

### Yeni antrenman → `workoutLog` başına ekle:
```js
{ date: 'XX Ay', type: 'Push', duration: '70dk', volume: '4.500 kg', sets: 20, highlight: 'Bench 62.5kg PR' }
```

### Performans güncellemesi → `performance[x].history` sonuna ekle + `val`, `note`, `trend` güncelle:
```js
{ date: 'May', val: 62.5 }
```

### Stat değişimi → `stats[x].val` güncelle (0-100).

### XP → `xp.current` güncelle.

### Quest tamamlandı → `done: true` yap.

### Başarı açıldı → `unlocked: true`, `date: 'Ay YYYY'` yap.

## Git Commit Konvansiyonları
- `workout: Push günü — Bench 62.5kg PR`
- `feat: yeni achievement eklendi`
- `fix: bug açıklaması`
- `data: weekly quest progress güncellendi`

## Kullanıcı Profili
- **Kullanıcı:** SenUzulme27 (@senuzulme27)
- **Sınıf:** Calisthenic Warrior / Acrobatic Sub-Class
- **Rank:** Silver III, Level 4
- **Ana eksikler:** Core (RANK F — 0 set), Bacak (ihmal edilmiş)
- **Güçlü yanlar:** Dead Hang (Elite), Bench 60kg, Muscle-Up x3, Front Flip
