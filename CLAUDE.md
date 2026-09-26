# Super Model Bros.: agent guide

A fan-made Three.js platformer about AI history. **Read `GOAL.md` first** for the goal and its
done-conditions, then `GAME_DESIGN.md` and `docs/` for the specs.

## Commands
```bash
npm install
npm run dev        # local dev server
npm test           # vitest: level parsing, physics, reachability, scoring, progression, sources
npm run typecheck  # tsc
npm run build      # typecheck + production build
```
Before every commit, run `npm test && npm run build`.

## Rules
- Content (levels, characters, themes, events, facts) lives in `src/config/`. Engine code never hardcodes history.
- Levels are ASCII maps; the legend is on `LevelSpec.map` in `src/config/levelSpec.ts`. Check jumps against
  the physics: for the weakest character a standing jump clears 3 tiles and a running jump 4, so a 4-tall pipe
  needs a run-up and nothing may need 5. `src/game/levels.test.ts` runs the reachability checker on every level;
  it fails on impossible jumps and soft-locks, and on jumps with no human margin: every level must still be
  finishable at `HUMAN_MARGIN` (90%) of the weakest jump, or 95% for a deliberate 4-tall climb named in
  `DELIBERATE_CLIMBS`. That checks height and distance to spare, not that the obvious route is safe: a block over
  a pit can still knock a runner in, so play those spots.
- Fact lines use `fact(text, ...sourceIds)`; gameplay advice uses `tip(text)`. Sources live in `src/config/sources.ts`.
- Pure logic (`level.ts`, `physics.ts`, `diet.ts`, and any new rules) gets unit tests. Rendering doesn't.
- Mario-inspired, not Mario: no Nintendo names, sprites, music, or layouts in the game.
- Every fact card line needs a source. Verify 🔎 facts before shipping. Never invent quotes attributed to real people.
- Rival labs are playable friends, never villains. Villains are abstract failure modes.
- Every feature works on keyboard (solo and co-op) and touch (landscape).
- Smoke test: `npm run build && npx vite preview --port 4173`, then `npm run smoke -- all` (or level ids). It drives
  Playwright at desktop size and in an iPhone landscape viewport and completes each level via `?debug`, which exposes
  `window.__smb` (teleport, state, bosses, stomp, give, next); `?debug&level=<id>` skips the title, `?debug&kart=<id>`
  runs one Benchmark Kart race, and smoke ids like `kart-arc` or `char:llama` test races and characters. Headless
  software rendering runs at ~12fps, so give timed inputs generous waits. Look at the screenshots in `smoke-shots/`.
- When a milestone lands, tick it in `GAME_DESIGN.md` → Milestones.
