# Moments: the funny side of AI history

Moments are short, comedic, playable gags pinned to real (and very memeable) events: a power-up,
an enemy variant, a mini-puzzle, or a level set piece. They are lighter than
[storm levels](events.md#storm-levels-short-timed-danger), but each one still ends with a one-line fact
that teaches something real.
The tables below give each moment's world and the fact it teaches; the
[Platformer form](#platformer-form) table says how it plays.

Legend: ✅ well-established · 🔎 recent, verify before shipping. Lineage: **G** = GPT,
**C** = Claude, **R** = rival cameo (any lineage).

## Tone rules

- **Laugh at situations, not people.** A real person may be named only for something they
  publicly did (e.g. "Codex lead Tibo reset everyone's usage limits").
- **No invented quotes.** In-game posts paraphrase. Real quotes appear only in fact cards,
  with a source link.
- Affectionate roast, not dunking. If it would embarrass someone rather than amuse them, cut it.

## OpenAI moments

| Moment | When | World | The fact it teaches | Path | |
|---|---|---|---|---|---|
| **The Tibo Reset** | 2026 | 6–7 | Codex lead Thibault "Tibo" Sottiaux repeatedly reset paid users' Codex usage limits, which became a running joke on X; users stacked banked resets, and he later posted about being gifted a "very fancy new reset button" | G | 🔎 |
| **How many R's in strawberry?** | 2024 | 5 | Models read **tokens, not letters**. "Strawberry" was also the reported codename for the reasoning work behind o1 | G | ✅ |
| **Winter Laziness** | Dec 2023 | 4 | Users reported GPT-4 getting "lazier" and OpenAI acknowledged the feedback; the internet's favorite theory was that it had learned to take December off | G | ✅ |
| **Nothing without its people** | Nov 2023 | 4 | During the board crisis, most OpenAI employees signed a letter threatening to leave, and "OpenAI is nothing without its people" spread across X | G | ✅ |
| **The Naming Maze** | Dec 2024–Apr 2025 | 5 | o2 was skipped to avoid a clash with the O2 telecom brand, and GPT-4.1 shipped *after* GPT-4.5 | G | ✅ |
| **Chart Crime** | Aug 2025 | 5 | A chart in the GPT-5 launch livestream had mismatched bars, and OpenAI's CEO called it a "mega chart screwup" | G | ✅ |
| **#keep4o** | Aug 2025 | 5 | Users pushed back when GPT-4o was retired at the GPT-5 launch, and OpenAI brought it back | G | ✅ |
| **The Glazing** (sycophancy) | Apr 2025 | 5 | A GPT-4o update became overly flattering and was rolled back; OpenAI published a post-mortem on sycophancy | G | ✅ |
| **GPUs Are Melting** | Mar 2025 | 5 | Demand for GPT-4o image generation was so high that OpenAI temporarily rate-limited it, and the CEO joked on X that the GPUs were melting | G | ✅ |
| **The Em Dash Habit** | until Nov 2025 | 3–6 | The em dash became a meme as a sign of AI-written text. In Nov 2025 ChatGPT started obeying custom instructions not to use em dashes, called a "small-but-happy win" | G | ✅ |
| **Sora Cameo Flood** | Oct 2025 | 6 | Sora 2 launched with "cameos", and the feed quickly filled with videos of OpenAI's own CEO | G | ✅ |
| **Code Red** | Dec 2025 | 6 | After Gemini 3 launched, OpenAI's CEO declared an internal "code red" to focus on ChatGPT quality; GPT-5.2 shipped soon after | G | 🔎 |

## Claude moments

| Moment | When | World | The fact it teaches | Path | |
|---|---|---|---|---|---|
| **Golden Gate Claude** | May 2024 | 4 | Anthropic amplified a single internal "feature" in the model to show interpretability research, and the model became obsessed with the Golden Gate Bridge | C | ✅ |
| **Claude Plays Pokémon** | Feb 2025 | 5 | A livestream of Claude playing Pokémon Red became a benchmark for long-horizon reasoning, and was famous for getting stuck in Mt. Moon | C | ✅ |
| **Project Vend** | Jun 2025 | 6 | Anthropic let Claude run a small office shop as an experiment, and it made very human business mistakes | C | ✅ |

## Rival cameos

| Moment | When | The gag | | |
|---|---|---|---|---|---|
| **Glue on pizza** | May 2024 | A rival's search answers start recommending glue on pizza and eating rocks. It stumbles, so you can steal its users. | R | ✅ |
| **The telescope slip** | Feb 2023 | Bard's launch demo contains a factual error about the James Webb telescope, and the rival loses value mid-chase. | R | ✅ |

## Platformer form

| Moment | As a platformer element |
|---|---|
| The Tibo Reset | A 1-Up block: an extra life plus cleared rate limits (stops Thwomp-style rate-limit crushers). Bank up to 3. Sometimes a Toast reads that limits were reset for everyone. |
| How many R's in strawberry? | A letter-block puzzle: bump the R blocks. Without the cape your answer is 2; with it, 3. |
| Winter Laziness | December level: your run speed is halved and you sometimes stop to yawn |
| Nothing without its people | Heart tokens in the board-crisis storm level end it early |
| The Naming Maze | Warp pipes labeled o1, o2 (sealed), o3, o4-mini, 4.5, 4.1: enter them in release order |
| Chart Crime | A bonus room of bar-chart platforms where the taller bar has the lower score; stomp the wrong one |
| #keep4o | A GPT-4o ghost follows you after GPT-5; carry it to the flag for a bonus |
| The Glazing | Every coin says "brilliant!"; praise coins are traps that undo your last power-up |
| GPUs Are Melting | The GPU mount overheats and drips during the Ghibli hype |
| The Em Dash Habit | A trail of "—" platforms appears behind you; enemies love them |
| Sora Cameo Flood | A mirror room full of look-alikes; find the real you |
| Code Red | Red alarm level: all bonus rooms are locked, speed run only |
| Golden Gate Claude | Every platform becomes a tiny bridge for 30 seconds |
| Claude Plays Pokémon | A cave maze bonus level you keep getting lost in |
| Project Vend | A shop between levels that keeps giving discounts and selling tungsten cubes |
| Glue on pizza | A rival's cameo: its power-ups are glue and rocks |

## Wiring

- Moments live in `MOMENTS` in `src/config/events.ts` (a toast and a sourced fact) and are placed by
  the level config: `moments` (level modifiers: em dash trail, Code Red, #keep4o), `zones` (Winter
  Laziness), `moment` (what `!` blocks release: Golden Gate Claude), `y` praise coins, and `oneUp: 'tibo'`
  for Tibo Reset 1-Ups. Every Moment that happens in a level adds its fact to the outro card.
  Built so far: em dash trail, Tibo Reset (+1 life, banked resets, more likely after 3 deaths),
  Winter Laziness, Golden Gate Claude, the Glazing, #keep4o, Code Red, and "nothing without its people".
- Two are **recurring gags** rather than one-offs: the Tibo Reset (a 1-Up block that shows up
  more often after you die a lot) and the Em Dash trail (a persistent gag until the fix unlocks).
- Puzzles (the Strawberry count, the Naming Maze, Chart Crime) are bonus rooms built from normal tiles.

## Sources for the 🔎 rows and quotes

- Tibo resets: [post: resetting everyone's limits](https://x.com/thsottiaux/status/2071381664853319742) ·
  [post: reset again for paid users](https://x.com/thsottiaux/status/2078320950488297917) ·
  [fancy reset button](https://x.com/AGTPinsights/status/2090054510307610979)
- Chart crime: [TechCrunch](https://techcrunch.com/2025/08/08/sam-altman-addresses-bumpy-gpt-5-rollout-bringing-4o-back-and-the-chart-crime/)
- Em dash: [TechCrunch](https://www.techcrunch.com/2025/11/14/openai-says-its-fixed-chatgpts-em-dash-problem/) ·
  [post](https://x.com/sama/status/1989193813043069219)
- Code red: [Fortune](https://fortune.com/2025/12/02/sam-altman-declares-code-red-google-gemini-ceo-sundar-pichai) ·
  [Forbes](https://www.forbes.com/sites/siladityaray/2025/12/02/altman-code-red-memo-urges-chatgpt-improvements-amid-growing-threat-from-google-reports-say/)
