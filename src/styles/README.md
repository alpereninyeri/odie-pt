# Styles Map

## Active load order

`src/main.js` tek stylesheet import eder:

1. `cozy-reforge.css` - aktif Mission HUD arayuzu.

## Source of truth

- `src/main.js` - route/map/defter/ODIE render tree ve event binding.
- `src/styles/cozy-reforge.css` - tum aktif token, Mission HUD, form, bottom sheet, nav ve responsive kurallari.
- `src/assets/game/cozy-v3/*` - aktif gorsel asset seti.

## Removed

Eski tema katmanlari artik yok:

- `riftline.css`
- `odie-ui.css`
- `cozy-rpg/mobile.css`

Yeni gorsel is `cozy-reforge.css` icine eklenmeli. Backend/data dosyalari bu tema resetinin parcasi degil.

## Dormant components

- Silindi: `daily-checklist.js`, `heatmap-calendar.js`; aktif karsiliklari `src/main.js` icinde.
- Tutuldu: `workout-form.js`, `modal.js`, `toast.js`, `panel-ask.js`, `panel-coach.js`; bunlar tekrar baglama/refactor icin bekliyor.
