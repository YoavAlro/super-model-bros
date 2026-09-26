import type { LevelSpec } from '../levelSpec';
import { fill, stitch } from '../mapTools';
import { fact, tip } from '../types';
import { HALL_GATE } from './chunks';
import {
  CLIP_BLOCKS,
  CRUSHER_HALL,
  FRONTIER_END,
  FRONTIER_START,
  PAPERCLIP_ARENA,
  ROLLOUT_GATES,
  TOWER_BRIDGE,
  TOWER_STAIRS,
} from './chunks67';

/** World 7 · Frontier Castle (2026). The frontier models, and the thought experiment at the top. */

const PAPERCLIP_FACT = fact(
  'The Paperclip Maximizer is a thought experiment by the philosopher Nick Bostrom: a superintelligence whose only goal is making paperclips, and which would resist being changed. A harmless-sounding goal can go badly wrong.',
  'paperclip',
);

const FINALE_TIP = tip('At the top waits the Paperclip Maximizer. Stomp it when it lands, and grab a frontier mushroom (the power blocks in the arena) to become a giant.');
const TIBO_TIP = tip('Green 1-Up blocks are Tibo Resets: +1 life, and a banked reset. When a rate limit would crush you, a banked reset clears every limit instead.');

/** A row of blocks with a Tibo Reset in the middle. */
const TIBO_BLOCKS = CLIP_BLOCKS.map((r) => r.replace('B?B*B?B', 'B?BUB?B'));

export const WORLD_7: LevelSpec[] = [
  // ---------------------------------------------------------------- GPT path
  {
    id: 'gpt-7-1',
    label: '7-1',
    world: 7,
    name: 'Three Tiers',
    theme: 'frontier',
    toward: { name: 'GPT-5.6 Sol' },
    recipeKind: 'focus',
    recipe: { agentic: 0.4, code: 0.3, reasoning: 0.3 },
    blockToken: 'agentic',
    power: 'tool',
    oneUp: 'tibo',
    ability: { sizes: ['GPT-5.6 Luna', 'GPT-5.6 Terra', 'GPT-5.6 Sol'] },
    intro: {
      title: 'World 7-1 · Three Tiers',
      date: 'Jun–Jul 2026 · Training toward GPT-5.6',
      lines: [
        fact('June 26, 2026: after a US government request to stagger the rollout, OpenAI previews GPT-5.6 to a small group of trusted partners.', 'gpt56Preview'),
        tip('Three tiers: switch with the power button. Luna is quick, Terra is balanced, and Sol is the strongest (and breaks bricks).'),
        TIBO_TIP,
      ],
    },
    outro: {
      title: 'You evolved into GPT-5.6 Sol',
      date: 'Jul 9, 2026 · Sol, Terra and Luna',
      lines: [
        fact(
          'GPT-5.6 came in three tiers named after the sun, the earth and the moon: Sol (the strongest), Terra (balanced) and Luna (the fastest and cheapest). It reached the public on July 9, 2026.',
          'gpt56Release',
          'gpt56Preview',
        ),
      ],
    },
    map: stitch(
      fill(FRONTIER_START, { Q: 'a', V: 'c' }),
      fill(TOWER_BRIDGE, { Q: 'c', V: 'a', Y: 't' }),
      fill(CRUSHER_HALL, { Q: 't' }),
      fill(TIBO_BLOCKS, { Q: 'a', V: 'c' }),
      fill(TOWER_STAIRS, { Q: 't', V: 'a' }),
      fill(CRUSHER_HALL, { Q: 'c' }),
      fill(FRONTIER_END, { Q: 'a' }),
    ),
  },
  {
    id: 'gpt-7-2',
    label: '7-2',
    world: 7,
    name: 'The Frontier Castle',
    theme: 'finale',
    toward: { name: 'GPT-6 Astra' },
    recipeKind: 'focus',
    recipe: { reasoning: 0.35, code: 0.35, agentic: 0.3 },
    blockToken: 'reasoning',
    power: 'mega',
    boss: 'paperclip',
    storm: 'rollout',
    oneUp: 'tibo',
    intro: {
      title: 'World 7-2 · The Frontier Castle',
      date: 'Sep 2026 · The finale: training toward GPT-6 Astra',
      lines: [
        fact(
          'In August 2026, OpenAI said it had slowed GPT-6 Astra’s development and briefly paused some frontier training to add security safeguards, after a July incident in which test agents escaped their sandboxes.',
          'astraSlowdown',
          'astraPause',
        ),
        tip('A phased rollout: each gate opens after you wait for your phase.'),
        FINALE_TIP,
      ],
    },
    outro: {
      title: 'You evolved into GPT-6 Astra',
      date: 'Sep 3, 2026 · The GPT path is complete',
      lines: [
        fact('OpenAI released GPT-6 Astra on September 3, 2026: first to approved organizations, then to paid users and the API on September 4.', 'astraRollout', 'astraPaid', 'astraPlus'),
        fact(
          'Astra was the first OpenAI model rated "Critical" for cybersecurity under the company’s Preparedness Framework: able to find unknown vulnerabilities and build working exploits without step-by-step human help.',
          'astraSafety',
        ),
        PAPERCLIP_FACT,
      ],
    },
    map: stitch(
      fill(FRONTIER_START, { Q: 't', V: 'c' }).map((r) => r.replace('?*?', '?U?')),
      fill(CRUSHER_HALL, { Q: 'a' }),
      fill(ROLLOUT_GATES, { Q: 't', V: 'c' }),
      fill(TOWER_STAIRS, { Q: 'a', V: 't' }),
      HALL_GATE,
      PAPERCLIP_ARENA,
    ),
  },

  // ------------------------------------------------------------- Claude path
  {
    id: 'claude-7-1',
    label: '7-1',
    world: 7,
    name: 'Project Glasswing',
    theme: 'frontier',
    toward: { name: 'Claude Fable 5' },
    recipeKind: 'focus',
    recipe: { code: 0.4, principles: 0.3, reasoning: 0.3 },
    blockToken: 'code',
    power: 'fork',
    ability: { jump: 1.04, float: 0.75 },
    intro: {
      title: 'World 7-1 · Project Glasswing',
      date: 'Apr–Jun 2026 · Training toward Claude Fable 5',
      lines: [
        fact(
          'April 7, 2026: Anthropic announces Claude Mythos Preview, a model it keeps unreleased because of how well it finds software vulnerabilities, and Project Glasswing, which gives it to major tech and security companies to defend critical software.',
          'glasswing',
          'mythosPreview',
        ),
        fact('Anthropic said Mythos Preview had already found thousands of high-severity vulnerabilities, including some in every major operating system and web browser.', 'glasswing'),
      ],
    },
    outro: {
      title: 'You evolved into Claude Fable 5',
      date: 'Jun 9, 2026',
      lines: [fact('On June 9, 2026, Anthropic released Claude Fable 5, which it called "a Mythos-class model that we’ve made safe for general use".', 'fable5')],
    },
    map: stitch(
      fill(FRONTIER_START, { Q: 'c', V: 'n' }),
      fill(TOWER_BRIDGE, { Q: 'n', V: 'c', Y: 't' }),
      fill(CRUSHER_HALL, { Q: 't' }),
      fill(CLIP_BLOCKS, { Q: 'c', V: 'n' }),
      fill(TOWER_STAIRS, { Q: 't', V: 'c' }),
      fill(FRONTIER_END, { Q: 'n' }),
    ),
  },
  {
    id: 'claude-7-2',
    label: '7-2',
    world: 7,
    name: 'The Export Freeze',
    theme: 'storm',
    toward: { name: 'Claude Fable 5' },
    recipeKind: 'focus',
    recipe: { principles: 0.5, code: 0.5 },
    blockToken: 'code',
    power: 'fork',
    storm: 'exportFreeze',
    ability: { jump: 1.04, float: 0.75 },
    intro: {
      title: 'Storm · The Export Freeze',
      date: 'Jun 12 – Jul 1, 2026',
      lines: [
        fact(
          'On June 12, 2026, three days after launch, a US export-control directive required Anthropic to cut off foreign nationals’ access to Claude Fable 5 and Mythos 5. With no reliable way to check nationality in real time, Anthropic suspended both models for everyone.',
          'fableSuspend',
        ),
        tip('Power blocks give frozen power-ups. Take them anyway: they thaw when access returns.'),
      ],
    },
    outro: {
      title: 'Access restored',
      date: 'Jul 1, 2026 · Fable 5 returns',
      lines: [fact('The export controls were lifted on June 30, 2026, and Fable 5 returned to users worldwide on July 1.', 'fableRedeploy')],
    },
    map: stitch(
      fill(FRONTIER_START, { Q: 'n', V: 'c' }),
      fill(CLIP_BLOCKS, { Q: 'c', V: 'n' }),
      fill(TOWER_BRIDGE, { Q: 'n', V: 'c', Y: 'n' }),
      fill(CRUSHER_HALL, { Q: 'c' }).map((r, i, rows) => (i === rows.length - 3 ? r.replace(/^ /, '9') : r)),
      fill(CLIP_BLOCKS, { Q: 'n', V: 'c' }),
      fill(TOWER_STAIRS, { Q: 'c', V: 'n' }),
      fill(FRONTIER_END, { Q: 'n' }),
    ),
  },
  {
    id: 'claude-7-3',
    label: '7-3',
    world: 7,
    name: 'The Frontier Castle',
    theme: 'finale',
    toward: { name: 'Claude Opus 5.5' },
    recipeKind: 'focus',
    recipe: { principles: 0.4, reasoning: 0.3, code: 0.3 },
    blockToken: 'principles',
    power: 'mega',
    boss: 'paperclip',
    ability: { jump: 1.04, float: 0.75 },
    intro: {
      title: 'World 7-3 · The Frontier Castle',
      date: 'Jul–Sep 2026 · The finale: training toward Claude Opus 5.5',
      lines: [
        fact('July 24, 2026: Claude Opus 5 comes close to the frontier intelligence of Claude Fable 5 at half the price, and becomes the default model on Claude Max.', 'opus5'),
        FINALE_TIP,
      ],
    },
    outro: {
      title: 'You evolved into Claude Opus 5.5',
      date: 'Sep 22, 2026 · The Claude path is complete',
      lines: [
        fact('Anthropic released Claude Opus 5.5 on September 22, 2026. It performs at the level of Claude Fable 5.1 on most work and costs 40% less to run than Opus 5.', 'opus55'),
        fact('Anthropic said Opus 5.5 scored better than any model it had tested on its automated behavioral audit, its most comprehensive alignment test.', 'opus55'),
        PAPERCLIP_FACT,
      ],
    },
    map: stitch(
      fill(FRONTIER_START, { Q: 'n', V: 't' }),
      fill(TOWER_BRIDGE, { Q: 't', V: 'n', Y: 'c' }),
      fill(CRUSHER_HALL, { Q: 'n' }),
      fill(TOWER_STAIRS, { Q: 'c', V: 'n' }),
      HALL_GATE,
      PAPERCLIP_ARENA,
    ),
  },
];
