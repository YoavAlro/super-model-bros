# SUPER MODEL BROS.: Game Design Brief

> A fan-made, educational 2.5D platformer about how AI evolved. GPT and Claude are the two
> brothers, running and jumping through the real history of AI, from a blank Transformer to the frontier.

## Pitch

A Mario-*inspired* side-scroller (original names, art, and sound; see [IP rules](#ip--accuracy-rules)).
Each world is an era of AI history. The tokens you collect are the real training data, each level's
flag shows the real release date, bosses are the real dangers AI labs faced, and every level ends
with a short, sourced fact card. The funny moments of AI history are power-ups, enemies, and gags.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Title | **Super Model Bros.** |
| Brothers | **GPT** (the famous one) and **Claude** (the brother who left home in 2021 and jumps higher) |
| Endgames | GPT → **GPT-6 Astra** (Sep 2026) · Claude → **Claude Opus 5.5** (Sep 2026) |
| Rival labs | **Unlockable playable characters** (Gemini, Llama, DeepSeek, Mistral, Grok), plus Benchmark Kart rivals. Never villains. |
| Multiplayer | **Local co-op on one keyboard** now; online multiplayer is a later milestone (it needs hosting) |
| Tone | Educational, affectionate, and funny. Laugh at situations, not people. |
| Platform | Desktop and mobile (touch d-pad plus A/B; landscape) |
| Stack | Three.js + TypeScript + Vite; tile-grid physics; levels as ASCII maps in `src/config/` |

## Detail docs

- [docs/cast.md](docs/cast.md): characters, enemies, power-ups, bosses
- [docs/worlds.md](docs/worlds.md): the 7 worlds, their levels, and the model timeline for both lineages
- [docs/events.md](docs/events.md): hype power-ups, storm levels, and X/Twitter moments
- [docs/moments.md](docs/moments.md): funny gags (the Tibo Reset, strawberry, Chart Crime...)

## Core loop

1. **Run and jump** through a level. Stomp enemies, bump blocks, grab power-ups.
2. **Collect tokens**: the data types (Books, Web, Wikipedia, Code, Human Feedback...) float in the level.
   The real training mix for the model you are becoming shows in the HUD, with target markers.
3. **Reach the flag.** It carries the model's name and release date. You evolve, and your name tag
   changes (Transformer → GPT-1 → GPT-2...).
4. **History stars**: your token mix against the real mix gives ★ to ★★★ (≥90% match for 3 stars,
   ≥65% for 2). Harder routes hold the "wrong" tokens, so the stars reward knowing the history.
5. **The world's castle** ends in a boss. When it falls, the open-source helper says
   *"Thank you! But AGI is in another castle!"*
6. **Between worlds**, an optional **Benchmark Kart** race against rival labs (friends) on a track named after a
   real benchmark. The finale recap compares your whole run with the real timeline.

## Controls

| | Keyboard (solo) | Co-op: GPT | Co-op: Claude | Touch |
|---|---|---|---|---|
| Move | A/D or ←/→ | A/D | ←/→ | ◀ ▶ d-pad |
| Jump (hold for higher) | Space/W/↑/Z | W or Space | ↑ | A |
| Run | Shift/X | Left Shift | Right Shift, / or Enter | B |
| Power (tool calls, think, traits) | S/↓/C | S | ↓ | ✦ (shown when you have one) |
| Pause | Esc/P | Esc/P | Esc/P | II button |

In Benchmark Kart the same keys work: move switches lanes, jump hops over hurdles, and run spends tokens on a boost.

Physics feel: acceleration and friction, a variable jump height (release early for a short hop),
coyote time and jump buffering, and running jumps that go higher. Claude floats (lower fall gravity).

## Multiplayer

- **Now:** local co-op on one keyboard. The camera scrolls forward only, and both players stay on screen.
  A player who falls respawns next to the survivor; lives are shared.
- **Later (M9):** online co-op and versus. It needs a small hosted relay (e.g. WebSocket rooms).
  Keep the simulation a **fixed-step, input-driven loop** (it already is: 120 Hz steps from pad
  state) so a host-authoritative or rollback model can drop in without rewriting the game.

## IP & accuracy rules

- **Mario-inspired, not Mario.** No Nintendo names, sprites, music, sound effects, or level layouts.
  The Mario analogs in these docs are design notes only and never appear in-game.
- No company logos. Model and company names appear only as historical facts. The title screen always shows
  the non-affiliation disclaimer.
- Every fact card line is verifiable. Recent (🔎) facts are verified against primary sources before
  they ship. Never invent quotes attributed to real people.
- Rival labs are playable friends and kart rivals, never villains. Villains are abstract failure modes
  (hallucination, reward hacking, the paperclip maximizer), not companies or people.
- Political and legal events are stated neutrally, with dates.

## Tech map

| Path | What it is |
|---|---|
| `src/config/levels/world*.ts`, `chunks.ts`, `chunks67.ts` | Levels: ASCII map (stitched from chunks, with token placeholders), theme, the recipe, sourced intro/outro cards |
| `src/config/levelSpec.ts` | The `LevelSpec` type and the map legend |
| `src/config/paths.ts` | The GPT and Claude paths: which levels, in order (steps can be conditional) |
| `src/config/events.ts` | Storms, hype power-ups (effect, verdict, perk, sourced verdict card) and Moments (toast + sourced fact) |
| `src/game/hype.ts` | Pure hype and Moment rules: judging a call, scoring, Tibo resets, Code Red par (unit tested) |
| `src/config/sources.ts`, `types.ts` | Every cited source; `fact()` lines need one, `tip()` lines don't |
| `src/config/characters.ts` | Playable roster: physics tuning, trait, unlock rule |
| `src/config/themes.ts`, `dataTypes.ts` | Visual themes and token types (each token has a glyph as well as a color) |
| `src/game/level.ts`, `physics.ts`, `movement.ts`, `diet.ts` | Pure logic: grid, collision, player control, history scoring (unit tested) |
| `src/game/reach.ts` | Reachability checker: flies the real movement code through every level; tests fail on impossible jumps or soft-locks |
| `src/game/progress.ts` | Pure run rules: next level, world ends, unlocks (unit tested) |
| `src/game/Campaign.ts` | A run through a path: cards, saves, unlocks, world breaks |
| `src/game/Stage.ts` | One level: fixed-step loop, camera, collisions, powers, bosses |
| `src/game/Player.ts`, `Enemies.ts`, `Bosses.ts`, `Items.ts`, `Platforms.ts` | Actors (platforms are rideable actors: moving platforms, Timeline clouds) |
| `src/game/storm.ts`, `puzzleRules.ts`, `gates.ts`, `forks.ts` | Pure storm, puzzle, gate-timeline and fork rules (unit tested) |
| `src/game/recap.ts`, `src/config/recap.ts`, `src/ui/Recap.ts` | The finale recap: your stars and hype calls against the real timeline (rules unit tested) |
| `src/config/karts.ts`, `src/game/kart.ts`, `src/game/KartRace.ts` | Benchmark Kart: race config, the pure fixed-step race sim (unit tested), and its view |
| `src/game/Puzzles.ts` | Bonus puzzles built from map marks: strawberry, Naming Maze, Chart Crime, the lost cave, two-key plates |
| `src/game/LevelView.ts`, `meshes.ts` | Rendering (instanced tiles, backdrops, procedural meshes) |
| `src/game/Input.ts`, `pad.ts`, `sfx.ts` | Controls (1–2 keyboards + touch) feeding plain `Pad` state, and synthesized sound |
| `scripts/smoke.mjs` | Playwright smoke test: completes levels via `?debug` on desktop and iPhone landscape |

`?debug` in the URL exposes `window.__smb` (teleport, state, bosses, stomp, give, next) for Playwright smoke tests;
`?debug&level=claude-2-2` skips the title and starts that level (`&flags=shadowBooks`, `&perks=teamFork` set run state).

## Milestones

| # | Milestone | Contents |
|---|---|---|
| M1 ✅ | World 1 | Engine, co-op, touch, 1-1 BookCorpus Plains, 1-2 WebText Caves, 1-3 Common Crawl Castle + the Garbage In boss |
| M2 ✅ | World 2: Alignment Hills | Codex, InstructGPT; Claude joins; RLHF star; Reward Hacker boss; Claude's own path begins |
| M3 ✅ | World 3: Viral Skies | ChatGPT launch; the Timeline (Lakitu-style) cloud; DAN & Sydney twin boss; board-crisis storm level (GPT) and pause-letter fog storm (Claude) |
| M4 ✅ | Event system | Hype power-ups (lasting vs passing verdicts), storm levels, Moments gags, all config-driven |
| M5 ✅ | Worlds 4–5 | Tool Pipes (fire flower = function calls, injection piranhas); Reasoning Ghost House (cape = Think, hallucination ghosts, King Boo-style boss) |
| M6 ✅ | Worlds 6–7 | Swarm Factory (fork cherry = agent clones, two-key plates, rate-limit crushers, Rogue Swarm boss); storms for the Pentagon dispute, the export freeze and Astra's phased rollout; Frontier Castle (frontier mushroom, Paperclip Maximizer) → Astra / Opus 5.5 finales and the recap |
| M7 ✅ | Unlockables & Benchmark Kart | Gemini, Llama, DeepSeek, Mistral, Grok with their traits (Llama's open-weights copy, Grok's cloud); six Benchmark Kart races between worlds |
| M8 | Polish | Music, accessibility, performance, a fact-verification pass over every 🔎 |
| M9 | Online multiplayer | Hosted rooms for online co-op/versus |
