# Styles Map

## Active load order

`src/main.js` tek stylesheet import eder:

1. `cozy-reforge.css` - aktif Komuta / Harita / ODIE oyun arayuzu.

## Source of truth

- `src/main.js` - Komuta/Harita/ODIE render tree ve event binding.
- `src/styles/cozy-reforge.css` - tum aktif token, oyun UI, form, bottom sheet, nav ve responsive kurallari.
- `src/data/game-assets.js` - aktif cozy-v4 asset manifesti.
- `src/assets/game/cozy-v4/*` - aktif gorsel asset seti.

## Removed

Eski tema katmanlari artik yok:

- `riftline.css`
- `odie-ui.css`
- `cozy-rpg/mobile.css`

Yeni gorsel is `cozy-reforge.css` icine eklenmeli. Backend/data dosyalari bu tema resetinin parcasi degil.

## Dormant components

- Silindi: `daily-checklist.js`, `heatmap-calendar.js`; aktif karsiliklari `src/main.js` icinde.
- Tutuldu: `workout-form.js`, `modal.js`, `toast.js`, `panel-ask.js`, `panel-coach.js`; bunlar tekrar baglama/refactor icin bekliyor.
