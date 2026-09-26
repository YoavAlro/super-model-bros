# Super Model Bros.

A fan-made, educational platformer about how AI evolved. GPT and Claude run and jump through real
AI history: the tokens you collect are the real training data, each flag shows a real release date,
and the bosses are the real dangers AI labs faced.

**Two paths.** The GPT path starts as an untrained Transformer in 2017 and ends as GPT-6 Astra (Sep 2026);
the Claude path starts when Anthropic is founded in 2021 and ends as Claude Opus 5.5 (Sep 2026). All seven
worlds are playable: pre-training; alignment (RLHF star, Reward Hacker); Viral Skies (viral star, the Timeline,
DAN & Sydney, storm levels); Tool Pipes (tool flower, injection piranhas, Claude 3's three sizes); the
Reasoning Ghost House (reasoning cape, hallucination ghosts, the Hallucination King, and puzzles like "how many
R's in strawberry?"); the Swarm Factory (fork cherry agents, rate limits, the Rogue Swarm); and the Frontier
Castle (the frontier mushroom and the Paperclip Maximizer). Hype power-ups ask you to call them "passing hype"
or "lasting shift", Benchmark Kart races run between worlds, five rival-lab friends unlock as playable characters,
and the finale recap compares your run with real history. Solo, or co-op on one keyboard.

- Design: [GAME_DESIGN.md](GAME_DESIGN.md)
- Goal and done-conditions: [GOAL.md](GOAL.md)
- Details: [cast](docs/cast.md) · [worlds](docs/worlds.md) · [events](docs/events.md) · [moments](docs/moments.md)

## Play

```bash
npm install
npm run dev
```

| | Solo | Co-op GPT | Co-op Claude | Touch |
|---|---|---|---|---|
| Move | A/D or ←/→ | A/D | ←/→ | ◀ ▶ |
| Jump | Space / W / ↑ | W / Space | ↑ | A |
| Run | Shift | Left Shift | Right Shift | B |
| Power | S / ↓ | S | ↓ | ✦ |

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml` (test, build, deploy to GitHub Pages). Turn it on once under
**Settings → Pages → Source: GitHub Actions**.

---

A fan-made, educational parody. Not affiliated with or endorsed by Nintendo, OpenAI, Anthropic, Google,
Meta, DeepSeek, Mistral AI, xAI, or any other organization named.
