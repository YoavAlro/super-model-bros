# Super Model Bros.

A fan-made, educational platformer about how AI evolved. GPT and Claude run and jump through real
AI history: the tokens you collect are the real training data, each flag shows a real release date,
and the bosses are the real dangers AI labs faced.

**Two paths.** The GPT path starts as an untrained Transformer in 2017; the Claude path starts when
Anthropic is founded in 2021. Worlds 1–3 are playable: pre-training; alignment (Codex, InstructGPT,
Constitutional AI, Claude 1) with the RLHF star and the Reward Hacker; and Viral Skies (ChatGPT, GPT-4,
Claude 2 and 2.1) with the viral star, the Timeline cloud, the DAN & Sydney twin boss, and two storm levels.
Solo, or co-op on one keyboard.

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
