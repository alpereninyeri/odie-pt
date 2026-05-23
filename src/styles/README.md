# Styles Map

Current load order:

1. `odie-ui.css`
2. `heroic-rpg.css`
3. `infographic-game.css`
4. `mobile-revolution.css`
5. `hunter/mobile-rpg.css`

Purpose:

- `odie-ui.css`: active shell, theme tokens, modal/form styles, mobile HUD, ODIE panels, character page, and recovery widgets.
- `heroic-rpg.css`: mobile-first HUD/theme override, tactical RPG visual language, and responsive polish.
- `infographic-game.css`: stat-board and next-move infographic surfaces kept for desktop/detail layers.
- `mobile-revolution.css`: older Living Character Sheet / ODIE command center layer. Keep for shared pieces until safely retired.
- `hunter/mobile-rpg.css`: active mobile RPG layer. New Hunter Card, Quest, Character, ODIE, motion, and iPhone-size polish live here.

Cleanup note:

- Legacy passive CSS layers were removed. New mobile RPG work should extend `hunter/mobile-rpg.css` instead of adding another root-level override file.
