# Cast: characters, enemies, power-ups, bosses

"Analog" columns are design references only; they never appear in-game (see the IP rules in
[GAME_DESIGN.md](../GAME_DESIGN.md#ip--accuracy-rules)).

## Playable characters

| Character | Lab | Analog | Trait | Unlock |
|---|---|---|---|---|
| **GPT** | OpenAI | Mario | The famous brother: balanced and fast | Start |
| **Claude** | Anthropic | Luigi | Left home in 2021 (Anthropic's founders came from OpenAI). Jumps higher and floats longer: long context, long hang time | Start (co-op); solo path from World 2 |
| **Gemini** ✅ | Google | Peach-style float | Multimodal eyes: sees hidden blocks | Beat World 3 |
| **Llama** ✅ | Meta | Toad-style speed | Open weights: the power button drops a copy of itself for 12 s. It holds two-key plates, and you can stand on its head | Beat World 4 |
| **DeepSeek** ✅ | DeepSeek | | Efficient: gets up to speed on less compute (faster acceleration and run) | Beat World 5 |
| **Mistral** ✅ | Mistral AI | | A strong wind: run in mid-air to dash | Every history star in World 2 |
| **Grok** ✅ | xAI | | The power button summons a steerable Timeline cloud (8 s, then a 14 s recharge) | Beat World 6 |

Traits are affectionate nods to each model's real reputation, never digs. Unlocked characters are picked on the
title screen and can play either path. Unlock rules: `unlockRule` in `src/config/characters.ts`, checked by
`checkUnlocks` in `src/game/progress.ts` (unit tested on both real paths).

### Looks

Each mascot is an original toy-like design that evokes its lab through colour and a generic motif, never a logo
(builders in `src/game/characterMeshes.ts`, palettes in `look` in `src/config/characters.ts`).

| Character | Look |
|---|---|
| GPT | A green walking speech bubble with a cowlick; idle, his grin turns into "typing…" dots |
| Claude | A tall clay block with an ink face page, a long cream scarf (long context) and a quill |
| Gemini | Twin domes (the constellation's twins), blue and violet, each with its own face and mood |
| Llama | An upright llama in purple wool, with a gold "open weights" dumbbell charm |
| DeepSeek | A cobalt whale calf whose spout puffs faster as it runs (more with less) |
| Mistral | A sunset-gradient cat with a gust tail and a neckerchief (the mistral wind; Le Chat) |
| Grok | A space cadet in a bubble helmet with a wink and a towel (a Hitchhiker's nod) |

Enemies and bosses are failure modes drawn as objects with faces: a furious junk-mail envelope (Spambot), a
self-awarded trophy (Reward Hacker), a picked padlock (Jailbreaker), a 429 status slab (rate limit), a crowned
bedsheet ghost (Hallucination King), a one-eyed clip factory (Paperclip Maximizer).

## Benchmark Kart

Between worlds, a short, optional kart race on a track named after a real benchmark, against three rival
labs (friends). Three lanes: switch lanes, hop the red hurdles, drive over boost pads, and spend three tokens
on a boost. First place wins a life. Each race card teaches the benchmark (sourced) and the results card
spotlights a rival lab's real story. Rival pace is seeded jitter, never real benchmark scores.

| After world | Race | Benchmark |
|---|---|---|
| 1 (GPT only) | MMLU Motorway | MMLU (2020) |
| 2 | HumanEval Circuit | HumanEval (2021) |
| 3 | SWE-bench Rally | SWE-bench (2023) |
| 4 | ARC Prize Canyon | ARC (2019) and the 2024 ARC Prize |
| 5 | Last Exam Loop | Humanity's Last Exam (2025) |
| 6 | Saturation Speedway | GLUE (2018) → SuperGLUE (2019) |

Config: `KARTS` in `src/config/karts.ts`; the pure, fixed-step race sim is `src/game/kart.ts` (unit tested);
the view is `src/game/KartRace.ts`. Co-op races both players. The finale recap lists your places.

## Supporting cast

| Role | In-game | Why it fits |
|---|---|---|
| The princess | **AGI** | Running gag: *"Thank you! But AGI is in another castle!"* It's always next year. |
| The helper (Toad) | **The open-source helper** | Friendly, small, everywhere |
| The mount (Yoshi) | **The GPU** | A green mount you ride for speed. Ride it too hard and it melts (the GPUs Are Melting moment). |

## Enemies

| Enemy | Analog | Represents | Behavior |
|---|---|---|---|
| **Spambot** ✅ | Goomba | Junk web text | Walks and turns at walls; stomp it |
| **Hallucination ghost** ✅ | Boo | Hallucinations | Creeps closer only while you look away, just as hallucinations appear when you stop checking |
| **Jailbreaker** ✅ | Koopa | Jailbreak prompts | Stomp it into its shell, then kick the shell |
| **Injection piranha** ✅ | Piranha Plant | Prompt injection | Hides in tool pipes |
| **The Timeline** ✅ | Lakitu | X/Twitter hot takes | A cloud that drops spiky takes; ride it once it's beaten |
| **Rate limit** ✅ | Thwomp | Usage limits (HTTP 429) | Hangs from a ceiling and slams down when you rush under it; stand on it, or bait it and pass while it rises. A Tibo Reset freezes it |
| **Runaway agent** ✅ | | Agents acting on their own | Small, quick, hops toward you; the Rogue Swarm's minions |
| **Paperclip** ✅ | | The Maximizer's output | Walks and turns at walls; stomp it |
| **Copyright lawyer** ✅ | Hammer Bro | Copyright lawsuits | A walking briefcase ("copyright claim") that throws briefs in arcs |
| **Reward orb** ✅ | Coin trap | Reward hacking | Looks like a token but drains Alignment |

## Power-ups

| Power-up | Analog | What it does |
|---|---|---|
| **Tokens** ✅ | Coins | The training data. The mix sets your history stars. |
| **Scale crystal** ✅ | Mushroom | Grow bigger (more parameters) and break bricks |
| **Tool flower** ✅ | Fire Flower | Shoot function calls |
| **Viral star** ✅ | Star | Invincibility, like the ChatGPT launch |
| **Reasoning cape** ✅ | Cape | Glide slowly; hold to "think" and see hidden paths |
| **Fork cherry** ✅ | Double Cherry | Clone into agents that copy your moves (up to two); the power button lines them up behind you. Two-key plates need a fork (or a co-op partner) |
| **Tibo Reset** ✅ | 1-Up | An extra life and cleared rate limits; bank up to 3, and a banked reset saves you from a crusher |
| **Distill mushroom** | Mini mushroom | Shrink into a mini model (Haiku, 4o-mini): fit through small gaps |
| **Frontier mushroom** ✅ | Mega mushroom | Giant and invincible for 12 seconds, for the finale |
| **RLHF star** ✅ | Invincibility | Gold Human Feedback: raises Alignment (World 2+) |

## Bosses

| World | Boss | Represents | Fight |
|---|---|---|---|
| 1 | **Garbage In** ✅ | Unfiltered web data | Giant Spambot: charges, leaps (screen shake), spawns junk. Three stomps. |
| 2 | **Reward Hacker** ✅ | Reward hacking | Collects fake reward orbs to heal; make it chase the real objective |
| 3 | **DAN & Sydney** ✅ | The DAN jailbreak (2023) and the Bing "Sydney" transcripts | Twin boss. Based on "The Waluigi Effect", a real alignment idea: train for X and anti-X gets easier to elicit. |
| 4 | **Injection Piranha** ✅ | Prompt injection | Spits hidden instructions out of the pipes |
| 5 | **The Hallucination King** ✅ | Confident falsehoods | Only visible in Think mode |
| 6 | **The Rogue Swarm** ✅ | Runaway agents | The orchestrator hovers behind a shield while its agents run; stop every agent, then stomp it while it is down |
| 7 | **The Paperclip Maximizer** ✅ | The classic AI-safety thought experiment | The final castle. It hovers, drops paperclips, shakes, and slams down; stomp it while it rests (a frontier-size player can hit it anytime). A thought experiment, not a company. |
