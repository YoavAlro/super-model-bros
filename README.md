# Super Model Bros.

A fan-made, educational platformer about how AI evolved. GPT and Claude run and jump through real
AI history: the tokens you collect are the real training data, each flag shows a real release date,
and the bosses are the real dangers AI labs faced.

**World 1 is playable:** BookCorpus Plains → WebText Caves → Common Crawl Castle, where you evolve
from an untrained Transformer to GPT-3 and beat the Garbage In boss. Solo, or co-op on one keyboard.

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

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml` (test, build, deploy to GitHub Pages). Turn it on once under
**Settings → Pages → Source: GitHub Actions**.

---

A fan-made, educational parody. Not affiliated with or endorsed by Nintendo, OpenAI, Anthropic, Google,
Meta, DeepSeek, Mistral AI, xAI, or any other organization named.
