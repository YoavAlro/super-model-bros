import type { LevelSpec } from '../levelSpec';
import { fill, stitch } from '../mapTools';
import { fact, tip } from '../types';
import { HALL_GATE } from './chunks';
import {
  AGENT_YARD,
  BELT_RUN,
  BELT_STAIRS,
  CLOSED_ROAD,
  CLOSED_ROAD_HIGH,
  CRUSHER_HALL,
  FACTORY_END,
  FACTORY_START,
  FORK_ROOM,
  REOPENED_ROAD,
  SWARM_ARENA,
} from './chunks67';

/** World 6 · Swarm Factory (2025–mid 2026). Models learn to act, then to work in teams. */

const FORK_TIP = tip('Fork cherries clone you: forks copy your moves, stomp and collect, and never cost a life. Press the power button to line them up behind you.');
const LIMIT_TIP = tip('Rate limits (the 429 blocks) slam down when you rush under them. Bait one, then pass while it grinds back up. You can stand on top of them.');

const SWARM_FACT = fact(
  'The Rogue Swarm is runaway agents. A 2025 report on multi-agent risks warned that when many AI agents interact, new failures can appear even if each one seems safe on its own: miscoordination, conflict and collusion.',
  'multiAgentRisks',
);

/** Starts with one or two hype blocks instead of plain token blocks. */
const HYPE_START = FACTORY_START.map((r) => r.replace('?*?', '$*?'));
const HYPES_START = FACTORY_START.map((r) => r.replace('?*?', '$*$'));

export const WORLD_6: LevelSpec[] = [
  // ---------------------------------------------------------------- GPT path
  {
    id: 'gpt-6-1',
    label: '6-1',
    world: 6,
    name: 'Operator Assembly Line',
    theme: 'factory',
    toward: { name: 'Codex agent' },
    recipeKind: 'focus',
    recipe: { agentic: 0.5, web: 0.25, code: 0.25 },
    blockToken: 'agentic',
    power: 'fork',
    moments: ['emDash'],
    puzzle: { kind: 'forkPlates' },
    intro: {
      title: 'World 6-1 · Operator Assembly Line',
      date: 'Jan–May 2025 · Training toward agents',
      lines: [
        fact(
          'Worlds overlap: while models learned to think, they also learned to act. On January 23, 2025, OpenAI previewed Operator, an agent that uses its own web browser to do tasks for you.',
          'operator',
          'operatorNews',
        ),
        FORK_TIP,
        LIMIT_TIP,
      ],
    },
    outro: {
      title: 'You became an agent',
      date: 'May 16, 2025 · Codex',
      lines: [
        fact('OpenAI released deep research, an agent for multi-step research on the web, on February 2, 2025, and Codex, a cloud coding agent, on May 16.', 'deepResearch', 'codexAgent'),
      ],
    },
    map: stitch(
      fill(FACTORY_START, { Q: 'a', V: 'w' }),
      fill(BELT_RUN, { Q: 'c', V: 'a' }),
      fill(FORK_ROOM, { Q: 'w', V: 'a', Y: 'a' }),
      fill(CRUSHER_HALL, { Q: 'a' }),
      fill(AGENT_YARD, { Q: 'c', V: 'w' }),
      fill(FACTORY_END, { Q: 'a' }),
    ),
  },
  {
    id: 'gpt-6-2',
    label: '6-2',
    world: 6,
    name: 'Agent Mode Works',
    theme: 'factory',
    toward: { name: 'ChatGPT agent' },
    recipeKind: 'focus',
    recipe: { agentic: 0.5, tools: 0.3, web: 0.2 },
    blockToken: 'tools',
    power: 'fork',
    moments: ['emDash'],
    intro: {
      title: 'World 6-2 · Agent Mode Works',
      date: 'Jul 2025 · Training toward ChatGPT agent',
      lines: [
        fact('July 17, 2025: OpenAI launches ChatGPT agent, which combines Operator and deep research in one agent.', 'chatgptAgent'),
        tip('Belts on the stairs push you back down. Keep moving, and keep your forks close.'),
      ],
    },
    outro: {
      title: 'You evolved into ChatGPT agent',
      date: 'Jul 17, 2025',
      lines: [fact('ChatGPT agent was built from two earlier agents: Operator (January 2025) and deep research (February 2025).', 'chatgptAgent', 'operator', 'deepResearch')],
    },
    map: stitch(
      fill(FACTORY_START, { Q: 'u', V: 'a' }),
      fill(BELT_STAIRS, { Q: 'a', V: 'w' }),
      fill(CRUSHER_HALL, { Q: 'u' }),
      fill(BELT_RUN, { Q: 'a', V: 'u' }),
      fill(AGENT_YARD, { Q: 'w', V: 'a' }),
      fill(FACTORY_END, { Q: 'u' }),
    ),
  },
  {
    id: 'gpt-6-3',
    label: '6-3',
    world: 6,
    name: 'Code Red',
    theme: 'factory',
    toward: { name: 'GPT-5.2' },
    recipeKind: 'focus',
    recipe: { code: 0.4, reasoning: 0.3, agentic: 0.3 },
    blockToken: 'code',
    power: 'fork',
    moments: ['emDashFixed', 'codeRed', 'soraCameos'],
    intro: {
      title: 'World 6-3 · Code Red',
      date: 'Oct–Dec 2025 · Training toward GPT-5.2',
      lines: [
        tip('Notice anything missing behind your jumps?'),
        tip('Code red: there are no bonus rooms today. Speed-run to the flag under par for an extra life.'),
      ],
    },
    outro: {
      title: 'You evolved into GPT-5.2',
      date: 'Dec 11, 2025',
      lines: [fact('OpenAI released GPT-5.2 on December 11, 2025, aimed at professional knowledge work such as spreadsheets, presentations and code, in Instant, Thinking and Pro modes.', 'gpt52')],
    },
    map: stitch(
      fill(FACTORY_START, { Q: 'c', V: 't' }),
      fill(BELT_RUN, { Q: 't', V: 'c' }),
      fill(CRUSHER_HALL, { Q: 'a' }),
      fill(BELT_STAIRS, { Q: 'c', V: 't' }),
      fill(AGENT_YARD, { Q: 'a', V: 'c' }),
      fill(FACTORY_END, { Q: 't' }),
    ),
  },
  {
    id: 'gpt-6-4',
    label: '6-4',
    world: 6,
    name: 'Swarm Factory Keep',
    theme: 'factory',
    toward: { name: 'GPT-5.5' },
    recipeKind: 'focus',
    recipe: { agentic: 0.4, code: 0.3, tools: 0.3 },
    blockToken: 'agentic',
    power: 'fork',
    boss: 'rogueSwarm',
    hypes: ['moltbook'],
    intro: {
      title: 'World 6-4 · Swarm Factory Keep',
      date: 'Jan–Apr 2026 · Training toward GPT-5.5',
      lines: [
        fact('March 5, 2026: GPT-5.4 is OpenAI’s first general-purpose model that can operate a computer itself, reading the screen, clicking and typing.', 'gpt54'),
        tip('The Rogue Swarm’s orchestrator hides behind its agents. Stop every agent, then stomp the orchestrator while it is down. Forks help.'),
      ],
    },
    outro: {
      title: 'You evolved into GPT-5.5',
      date: 'Apr 23, 2026',
      lines: [
        fact('OpenAI released GPT-5.5 on April 23, 2026, less than two months after GPT-5.4, aimed at coding, operating a computer and deeper research.', 'gpt55'),
        SWARM_FACT,
      ],
    },
    map: stitch(
      fill(HYPE_START, { Q: 'a', V: 'u' }),
      fill(AGENT_YARD, { Q: 'c', V: 'a' }),
      fill(CRUSHER_HALL, { Q: 'u' }),
      fill(BELT_RUN, { Q: 'a', V: 'c' }),
      HALL_GATE,
      SWARM_ARENA,
    ),
  },

  // ------------------------------------------------------------- Claude path
  {
    id: 'claude-6-1',
    label: '6-1',
    world: 6,
    name: 'Subagent Assembly',
    theme: 'factory',
    toward: { name: 'Claude Opus 4.5' },
    recipeKind: 'focus',
    recipe: { agentic: 0.5, code: 0.3, principles: 0.2 },
    blockToken: 'code',
    power: 'fork',
    moment: 'projectVend',
    puzzle: { kind: 'forkPlates' },
    intro: {
      title: 'World 6-1 · Subagent Assembly',
      date: 'Nov 2025 · Training toward Claude Opus 4.5',
      lines: [
        fact('By November 2025, Claude Code, Anthropic’s coding agent, had reached $1 billion in run-rate revenue, six months after it became available to the public.', 'claudeCode1b'),
        FORK_TIP,
        LIMIT_TIP,
      ],
    },
    outro: {
      title: 'You evolved into Claude Opus 4.5',
      date: 'Nov 24, 2025',
      lines: [
        fact('Anthropic released Claude Opus 4.5 on November 24, 2025, calling it the best model in the world for coding, agents and computer use, at a new, lower price.', 'opus45'),
        fact('Anthropic found Opus 4.5 very effective at managing a team of subagents that work together as a well-coordinated multi-agent system.', 'opus45'),
      ],
    },
    map: stitch(
      fill(FACTORY_START, { Q: 'c', V: 'a' }).map((r) => r.replace('?*?', '!*?')),
      fill(BELT_RUN, { Q: 'a', V: 'n' }),
      fill(FORK_ROOM, { Q: 'c', V: 'a', Y: 'a' }),
      fill(CRUSHER_HALL, { Q: 'a' }),
      fill(AGENT_YARD, { Q: 'n', V: 'c' }),
      fill(FACTORY_END, { Q: 'a' }),
    ),
  },
  {
    id: 'claude-6-2',
    label: '6-2',
    world: 6,
    name: 'Agent Teams',
    theme: 'factory',
    toward: { name: 'Claude Opus 4.6', paramsLabel: '1M context' },
    recipeKind: 'focus',
    recipe: { agentic: 0.4, code: 0.4, principles: 0.2 },
    blockToken: 'agentic',
    power: 'fork',
    ability: { jump: 1.04, float: 0.8 },
    hypes: ['moltbook', 'agentTeams'],
    intro: {
      title: 'World 6-2 · Agent Teams',
      date: 'Jan–Feb 2026 · Training toward Claude Opus 4.6',
      lines: [
        fact('January 2026: an open-source agent, Clawdbot (soon renamed OpenClaw), goes viral, and so does Moltbook, a social network where only AI agents can post.', 'moltbook'),
        tip('Two hype blocks this time. When each power-up runs out, call it: passing hype, or lasting shift?'),
      ],
    },
    outro: {
      title: 'You evolved into Claude Opus 4.6',
      date: 'Feb 5, 2026 · 1M context',
      lines: [
        fact('Anthropic released Claude Opus 4.6 on February 5, 2026: its first Opus-class model with a 1M-token context window (in beta), and better at long-running agentic work.', 'opus46'),
      ],
    },
    map: stitch(
      fill(HYPES_START, { Q: 'a', V: 'c' }),
      fill(BELT_STAIRS, { Q: 'c', V: 'a' }),
      fill(CRUSHER_HALL, { Q: 'n' }),
      fill(AGENT_YARD, { Q: 'a', V: 'c' }),
      fill(BELT_RUN, { Q: 'c', V: 'n' }),
      fill(FACTORY_END, { Q: 'a' }),
    ),
  },
  {
    id: 'claude-6-3',
    label: '6-3',
    world: 6,
    name: 'Supply Chain Risk',
    theme: 'storm',
    toward: { name: 'Claude Opus 4.6', paramsLabel: '1M context' },
    recipeKind: 'focus',
    recipe: { principles: 1 },
    blockToken: 'principles',
    power: 'fork',
    storm: 'supplyChain',
    intro: {
      title: 'Storm · Supply Chain Risk',
      date: 'Feb–Sep 2026 · Anthropic and the Pentagon',
      lines: [
        fact(
          'February 2026: talks between Anthropic and the Pentagon break down over two uses Anthropic would not allow: mass domestic surveillance of Americans and fully autonomous weapons.',
          'pentagonTimeline',
          'pentagonStatement',
        ),
        tip('Some roads are closed to you. Climb over and find another way; one road reopens later.'),
      ],
    },
    outro: {
      title: 'You weathered the storm',
      date: 'Sep 2026 · The dispute goes on',
      lines: [
        fact(
          'On February 27, 2026, the US Defense Secretary said he was directing the Pentagon to designate Anthropic a "supply chain risk", and federal agencies were told to stop using its technology. Formal designations followed in March.',
          'pentagonStatement',
          'pentagonTimeline',
        ),
        fact('On August 27, 2026, a federal judge in California ruled one designation unlawful. On September 25, a federal appeals court in Washington upheld the other one, 2–1.', 'pentagonRuling', 'pentagonAppeal'),
      ],
    },
    map: stitch(
      [
        '                        ',
        '          ?*?           ',
        '                        ',
        '    nnn       nn        ',
        '  S                     ',
        '########################',
        '########################',
      ],
      CLOSED_ROAD.map((r) => r.replace(/Q/g, 'n').replace('i', 'd')),
      fill(AGENT_YARD, { Q: 'n' }),
      REOPENED_ROAD.map((r) => r.replace(/Q/g, 'n').replace('i', 'd')),
      fill(CRUSHER_HALL, { Q: 'n' }),
      CLOSED_ROAD_HIGH.map((r) => r.replace(/Q/g, 'n').replace('i', 'd')),
      fill(FACTORY_END, { Q: 'n' }),
    ),
  },
  {
    id: 'claude-6-4',
    label: '6-4',
    world: 6,
    name: 'Swarm Keep',
    theme: 'factory',
    toward: { name: 'Claude Opus 4.8' },
    recipeKind: 'focus',
    recipe: { agentic: 0.4, code: 0.4, images: 0.2 },
    blockToken: 'code',
    power: 'fork',
    boss: 'rogueSwarm',
    ability: { jump: 1.04, float: 0.8 },
    intro: {
      title: 'World 6-4 · Swarm Keep',
      date: 'Apr–May 2026 · Training toward Claude Opus 4.8',
      lines: [
        fact(
          'April 16, 2026: Claude Opus 4.7 sees images in greater resolution, and it is the first Claude model released with safeguards that automatically block high-risk cybersecurity requests.',
          'opus47',
        ),
        tip('The Rogue Swarm’s orchestrator hides behind its agents. Stop every agent, then stomp the orchestrator while it is down. Forks help.'),
      ],
    },
    outro: {
      title: 'You evolved into Claude Opus 4.8',
      date: 'May 28, 2026',
      lines: [
        fact('Claude Opus 4.8 followed on May 28, 2026, with "dynamic workflows" in Claude Code for very large tasks, like migrations across hundreds of thousands of lines of code.', 'opus48'),
        SWARM_FACT,
      ],
    },
    map: stitch(
      fill(FACTORY_START, { Q: 'c', V: 'v' }),
      fill(AGENT_YARD, { Q: 'a', V: 'c' }),
      fill(CRUSHER_HALL, { Q: 'v' }),
      fill(BELT_STAIRS, { Q: 'a', V: 'c' }),
      HALL_GATE,
      SWARM_ARENA,
    ),
  },
];
