Build "Super Model Bros." in this repo: a fan-made, educational 2.5D platformer (Three.js + TypeScript + Vite) about AI history. GPT and Claude are the two brothers, running through levels where tokens are the real training data, each flag shows a real model's release date, and bosses are the real dangers AI faced. World 1 is built. Read GAME_DESIGN.md and docs/*.md first, and follow CLAUDE.md.

Paths:
- GPT: Transformer (2017) through GPT-6 Astra (Sep 2026)
- Claude: joins in 2021, through Claude Opus 5.5 (Sep 2026)
(level-by-level timelines in docs/worlds.md)

Seven worlds, each with levels, a castle boss, and a new power:
1 Pre-training Plains: Garbage In (built)
2 Alignment Hills: RLHF star, Reward Hacker; Claude's solo path starts
3 Viral Skies: ChatGPT viral star, the Timeline (X/Twitter) cloud, DAN & Sydney twin boss, board-crisis storm
4 Tool Pipes: tool flower (function calls), injection piranhas, Injection Piranha boss
5 Reasoning Ghost House: reasoning cape (Think), hallucination ghosts, Hallucination King
6 Swarm Factory: fork cherry (agent clones), Rogue Swarm
7 Frontier Castle: Paperclip Maximizer, then the Astra / Opus 5.5 finale and a recap screen

Also build (see docs/cast.md, docs/events.md, docs/moments.md):
- Hype power-ups with a "Hype or shift?" verdict (lasting ones stay, passing ones fade), storm levels pinned to real incidents, and Moments gags (Tibo Reset 1-Up, strawberry R puzzle, Naming Maze, Chart Crime, sycophancy coins, em dash trail, Golden Gate Claude, etc.)
- Unlockable characters Gemini, Llama, DeepSeek, Mistral, Grok, each with its trait; Benchmark Kart races between worlds
- Local co-op on one keyboard (built). Keep the sim fixed-step and input-driven so online multiplayer can be added later.

Rules:
- Mario-inspired, not Mario: no Nintendo names, sprites, music, or layouts
- Accurate and educational: every fact card is sourced; verify 🔎 facts against primary sources, and fix or cut anything unverifiable
- Laugh at situations, not people; never invent quotes attributed to real people; no logos; rival labs are friends, never villains; state legal and political events neutrally
- Keyboard (solo and co-op) and touch (landscape) for everything; 60fps laptop, 30+ mid-range phone
- All content in src/config/; the engine never hardcodes history

Milestone order: M2 World 2, M3 World 3, M4 event system, M5 Worlds 4-5, M6 Worlds 6-7 + finales, M7 unlockables + Benchmark Kart, M8 polish (music, accessibility, performance, fact pass). M9 (online multiplayer) is out of scope unless asked. Each milestone ends with tests + build passing, a Playwright smoke test (desktop + iPhone landscape, no console errors, screenshots reviewed, the new levels completed via ?debug), a commit pushed to main, and the milestone ticked in GAME_DESIGN.md.

Done when ALL are true:
1. Both paths are playable from start to finale with no dead ends or impossible jumps
2. All 7 worlds, their bosses and powers, hype power-ups, storm levels, and Moments work on keyboard and touch
3. All 5 unlockable characters unlock and play with their traits
4. Every fact card has a source and no unverified 🔎 facts remain in shipped content
5. The finale recap compares the player's run (stars, hype verdicts) to real history
6. npm test and npm run build pass; unit tests cover physics, scoring, and the event/unlock rules
7. The smoke test passes for both paths, and all work is pushed to main with M2-M8 ticked
