# Events: hype power-ups, storm levels, and the Timeline

Legend: ✅ verified (🔎 marked a recent row still to verify; none are left). **G** = GPT path, **C** = Claude path, **B** = both.

## The Timeline (X/Twitter)

From World 3 on, the Timeline is a cloud enemy that drops spiky hot takes. Once you beat it, it's
a cloud you can ride. Its big moments are set pieces where virality lit the fire:

| When | Moment | Set piece | | |
|---|---|---|---|---|
| Dec 2022 | ChatGPT screenshots flood Twitter; 1M users in ~5 days | Viral star rain; a crowd of users follows you | B | ✅ |
| Feb 2023 | Bing "Sydney" transcripts go viral | The cloud turns red and drops backlash | B | ✅ |
| Nov 2023 | Grok launches inside X; the OpenAI board crisis plays out live on X | Grok cameo; board-crisis storm | B/G | ✅ |
| Jan 2025 | DeepSeek R1 trends and tops the App Store | Rival rush | B | ✅ |
| Feb 2025 | "Vibe coding" is coined on X | Hype power-up (lasting) | B | ✅ |
| Nov 2025 | Claude Code reaches $1B in run-rate revenue (the "viral over the holidays" framing could not be verified, so the card uses this) | Intro fact, Claude 6-1 | C | ✅ |
| Jan 2026 | OpenClaw and Moltbook screenshots spread | Hype power-up (passing) | B | ✅ |

In-game posts paraphrase moments anonymously. Never fabricate a quote attributed to a real person.

## Hype power-ups: lasting or passing?

A glowing hype block (`$` in a map, `hype` on the level) releases a timed power-up. When it ends, a
**"Hype or shift?"** card asks you to call it, then gives history's verdict. **Lasting** hypes leave a
permanent upgrade for the rest of the run (whatever you called); **passing** ones evaporate and leave a
short hangover (a slowdown). The recap scores your calls. Config: `HYPES` in `src/config/events.ts`;
rules: `src/game/hype.ts`. Placed: AutoGPT (GPT 3-2, Claude 3-2), Q* (GPT 3-3), GPT Store (GPT 4-2),
Sora and AI gadgets (GPT 4-3), AI gadgets (Claude 4-1), Artifacts (Claude 4-2), MCP (Claude 4-3), reasoning models
(GPT 5-1, Claude 5-2), vibe coding (GPT 5-3, Claude 5-2), Ghibli images (GPT 5-3), Moltbook (GPT 6-4, Claude 6-2)
and agent teams (Claude 6-2). The finale recap lists every hype on the path: your call next to history's verdict.

| Lasting hype | Upgrade it leaves |
|---|---|
| Artifacts | A safety net: once per level, a fall into a pit builds a platform |
| Reasoning models | A light glide: hold jump while falling |
| MCP | Springy pipes: land on a pipe to bounce high |
| Vibe coding | One vibe-coded mid-air jump |
| Agent teams | Every level starts with a fork on your team |

| When | Hype | Verdict | Power while it lasts | | |
|---|---|---|---|---|---|
| Apr 2023 | AutoGPT / BabyAGI | Passing (it returned years later as a real shift) | Clones that run into walls | B | ✅ |
| Nov 2023 | GPT Store / custom GPTs | Passing | Coin magnet | G | ✅ |
| Nov 2023 | "Q*" rumors | Passing | Hype only | G | ✅ |
| Feb 2024 | Sora demos | Passing at the time | Spectacle | G | ✅ |
| Apr 2024 | AI gadgets (AI Pin, Rabbit R1) | Passing | Jetpack that runs out | B | ✅ |
| Jun 2024 | Artifacts | Lasting | Build platforms | C | ✅ |
| Sep 2024 | Reasoning models | Lasting | Early cape | B | ✅ |
| Nov 2024 | MCP | Lasting | Every pipe connects | B | ✅ |
| Feb 2025 | Vibe coding | Lasting | Code tokens become platforms | B | ✅ |
| Mar 2025 | Ghibli-style images | Passing (the users stay) | User flood; the GPU mount overheats | G | ✅ |
| Jan 2026 | Moltbook: a social network for AI agents | Passing | Your forks post instead of helping | B | ✅ |
| Feb 2026 | Agent teams (Claude Code) | Lasting | Forks coordinate | C | ✅ |

## Storm levels (short, timed danger)

Auto-scrolling or hazard levels pinned to real incidents. Surviving one earns a fact card.

| When | Storm | Level mechanic | | |
|---|---|---|---|---|
| Dec 2022–2023 | "At capacity" outages **built** (set piece in GPT 3-1) | Platforms freeze and unfreeze | G | ✅ |
| Mar 31–Apr 28, 2023 | Italy temporarily bans ChatGPT | Part of the level closes; reroute | G | ✅ |
| Mar 2023 | "Pause giant AI experiments" open letter **built** (Claude 3-1) | Slow fog | B | ✅ |
| Nov 17–22, 2023 | OpenAI board crisis **built** (GPT 3-3) | Five auto-scrolling "days"; the ground shifts each day; heart tokens end it early | G | ✅ |
| Dec 2023 | NYT copyright lawsuit **built** (in GPT 4-2) | Copyright claims throw briefs; fact on the outro | G | ✅ |
| Jan 2025 | DeepSeek R1 shock **built** (GPT 5-2, Claude 5-1) | Speed-run against a cheap rival | B | ✅ |
| Sep 2025 | Authors' lawsuit settlement (~$1.5B) **built** (Claude 5-4) | Triggered if the Claude path grabbed "shadow library" books earlier (in 2-1) | C | ✅ |
| Jan–Feb 2026 | Agent security exposure (OpenClaw) | Folded into the Moltbook hype card (the exposed database) rather than its own storm | B | ✅ |
| Feb–Sep 2026 | Pentagon "supply chain risk" dispute **built** (Claude 6-3) | Closed roads you climb around; one reopens after the Aug 27 ruling, the last stays closed after the Sep 25 appeal ruling | C | ✅ |
| Jun 12–Jul 1, 2026 | Export-control suspension of Fable 5 / Mythos 5 **built** (Claude 7-2) | Power blocks give frozen power-ups; they thaw when access returns | C | ✅ |
| Sep 2026 | Critical cyber capability threshold **built** (GPT 7-2) | Phased rollout: gates open one at a time after you wait for your phase | G | ✅ |

Storm config: `STORMS` in `src/config/events.ts` (`gates` for closed roads and rollouts, `freeze` for the
export freeze); gate rules: `src/game/gates.ts` (unit tested, and the reachability checker keeps closed
roads shut).

## Sources for the recent rows

- [TechPolicy.Press: Anthropic–Pentagon timeline](https://www.techpolicy.press/a-timeline-of-the-anthropic-pentagon-dispute/) · [CNN: ruling](https://www.cnn.com/2026/08/27/tech/anthropic-pentagon-supply-chain-risk-unlawful-hnk)
- [Fortune: Moltbook / OpenClaw](https://fortune.com/2026/01/31/ai-agent-moltbot-clawdbot-openclaw-data-privacy-security-nightmare-moltbook-social-network/)
- [CNBC: Astra rollout](https://www.cnbc.com/2026/09/03/open-ai-astra-gpt-6-cyber.html)
