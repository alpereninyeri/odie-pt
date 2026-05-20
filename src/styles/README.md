# Styles Map

Current load order:

1. `odie-ui.css`
2. `heroic-rpg.css`
3. `infographic-game.css`
4. `mobile-revolution.css`

Purpose:

- `odie-ui.css`: active shell, theme tokens, modal/form styles, mobile HUD, ODIE panels, character page, and recovery widgets.
- `heroic-rpg.css`: mobile-first HUD/theme override, tactical RPG visual language, and responsive polish.
- `infographic-game.css`: stat-board and next-move infographic surfaces kept for desktop/detail layers.
- `mobile-revolution.css`: final mobile-first Living Character Sheet / ODIE command center layer.

Cleanup note:

- Legacy passive CSS layers were removed. New UI work should extend one of the four active files above instead of reintroducing a parallel override stack.
