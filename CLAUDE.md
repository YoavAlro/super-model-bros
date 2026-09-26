# Super Model Bros.: agent guide

A fan-made Three.js platformer about AI history. **Read `GOAL.md` first** for the goal and its
done-conditions, then `GAME_DESIGN.md` and `docs/` for the specs.

## Commands
```bash
npm install
npm run dev        # local dev server
npm test           # vitest: level parsing, physics, diet scoring
npm run typecheck  # tsc
npm run build      # typecheck + production build
```
Before every commit, run `npm test && npm run build`.

## Rules
- Content (levels, characters, themes, events, facts) lives in `src/config/`. Engine code never hardcodes history.
- Levels are ASCII maps; the legend is on `LevelSpec.map` in `src/config/levels.ts`. Check jumps against
  the physics: a standing jump clears ~4 tiles, and a 4-tall pipe needs a running jump.
- Pure logic (`level.ts`, `physics.ts`, `diet.ts`, and any new rules) gets unit tests. Rendering doesn't.
- Mario-inspired, not Mario: no Nintendo names, sprites, music, or layouts in the game.
- Every fact card line needs a source. Verify 🔎 facts before shipping. Never invent quotes attributed to real people.
- Rival labs are playable friends, never villains. Villains are abstract failure modes.
- Every feature works on keyboard (solo and co-op) and touch (landscape).
- Smoke test: `npm run build && npx vite preview`, then drive it with Playwright at desktop size and in an
  iPhone landscape viewport. `?debug` exposes `window.__smb` (teleport, state, bossHp). Headless
  software rendering runs at ~12fps, so give timed inputs generous waits. Look at the screenshots.
- When a milestone lands, tick it in `GAME_DESIGN.md` → Milestones.
