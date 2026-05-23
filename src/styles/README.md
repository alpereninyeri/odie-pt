# Styles Map

Current load order:

1. `odie-ui.css`
2. `cozy-rpg/mobile.css`

Purpose:

- `odie-ui.css`: shared shell, layout, modal/form primitives, and legacy desktop fallback.
- `cozy-rpg/mobile.css`: active mobile cozy indie RPG skin. Today, Vital OS, Quest, ODIE, modals, bottom nav, motion, and generated game assets live here.

Cleanup note:

- Legacy mobile override files were removed from the active style tree. New mobile RPG work should extend `cozy-rpg/mobile.css` instead of adding another root-level override file.
