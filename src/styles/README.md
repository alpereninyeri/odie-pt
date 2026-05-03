# Styles Map

Current load order:

1. `odie-ui.css`
2. `heroic-rpg.css`

Purpose:

- `odie-ui.css`: active shell, theme tokens, modal/form styles, mobile HUD, ODIE panels, character page, and recovery widgets.
- `heroic-rpg.css`: mobile-first HUD/theme override, tactical RPG visual language, and responsive polish.
- The old files are kept in the repo for reference only and are no longer imported by `src/main.js`.

Cleanup targets:

- Delete or archive unused legacy selectors after one live deploy cycle.
- Remove dormant component modules once their replacement surfaces are confirmed.
