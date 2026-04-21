# Styles Map

Current load order:

1. `style.css`
2. `legacy-overrides.css`
3. `theme-mmo.css`
4. `hud-ask.css`

Purpose:

- `style.css`: base tokens, shared widgets, still-used generic surfaces.
- `legacy-overrides.css`: old V3.1-V5.1 cascade that still props up parts of the app.
- `theme-mmo.css`: current parchment/MMO skin and late-stage visual overrides.
- `hud-ask.css`: Ask page, mobile HUD chips, home command deck.

Next cleanup targets:

- Remove leftover dead selectors in `style.css`: old `quest-tabs`, `ach-grid`, `log-table`, `mrow`, `prow`, `ring-card`, `hcard`.
- Reduce duplicate `:root`, `glass-card`, `bottom-tabs`, `mobile-hud`, and modal overrides in `legacy-overrides.css`.
- Promote stable current selectors from `theme-mmo.css` back into a slimmer long-term theme file once the legacy chain is pruned.
