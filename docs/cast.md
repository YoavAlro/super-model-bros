# Cast: characters, enemies, power-ups, bosses

"Analog" columns are design references only; they never appear in-game (see the IP rules in
[GAME_DESIGN.md](../GAME_DESIGN.md#ip--accuracy-rules)).

## Playable characters

| Character | Lab | Analog | Trait | Unlock |
|---|---|---|---|---|
| **GPT** | OpenAI | Mario | The famous brother: balanced and fast | Start |
| **Claude** | Anthropic | Luigi | Left home in 2021 (Anthropic's founders came from OpenAI). Jumps higher and floats longer: long context, long hang time | Start (co-op); solo path from World 2 |
| **Gemini** | Google | Peach-style float | Multimodal eyes: sees hidden blocks | Beat World 3 |
| **Llama** | Meta | Toad-style speed | Open weights: drops a copy of itself to help | Beat World 4 |
| **DeepSeek** | DeepSeek | | Efficient: runs further on less compute | Beat World 5 |
| **Mistral** | Mistral AI | | A strong wind: air dash | Every history star in World 2 |
| **Grok** | xAI | | Rides the Timeline cloud | Beat World 6 |

Traits are affectionate nods to each model's real reputation, never digs.

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
