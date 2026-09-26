import type { CharacterId } from './characters';
import { fact, tip, type FactCard, type FactLine } from './types';

/**
 * Benchmark Kart: a race between worlds on a track named after a real benchmark. Rival labs are
 * friends; rival karts drive with seeded, equal pace, never their real benchmark scores.
 * The sim is `src/game/kart.ts`; the renderer is `src/game/KartRace.ts`.
 */

export interface KartTheme {
  skyTop: string;
  skyBottom: string;
  road: number;
  stripe: number;
  ground: number;
}

export interface KartSpec {
  id: string;
  /** Raced right after this world's castle. */
  afterWorld: number;
  name: string;
  length: number;
  hurdles: number;
  pads: number;
  tokens: number;
  /** Preferred rivals (friends); anyone the player drives is swapped out. */
  rivals: CharacterId[];
  /** A rival's real story, shown with the results. */
  spotlight: FactLine;
  theme: KartTheme;
  intro: FactCard;
}

const CONTROLS = tip('◀ ▶ (A/D or ←/→) switch lanes, jump hops over hurdles, and run spends 3 tokens on a boost. Win for an extra life.');
const FRIENDS = tip('Rival karts are friends. Their speed is random each race, not their real benchmark scores.');

export const KARTS: KartSpec[] = [
  {
    id: 'kart-mmlu',
    afterWorld: 1,
    name: 'MMLU Motorway',
    length: 520,
    hurdles: 14,
    pads: 6,
    tokens: 18,
    rivals: ['gemini', 'llama', 'mistral'],
    spotlight: fact('Meta’s first LLaMA models (February 2023) came in four sizes, from 7B to 65B parameters, and were released to researchers.', 'llama1'),
    theme: { skyTop: '#4f86f7', skyBottom: '#b8e2ff', road: 0x3a3f4a, stripe: 0xffffff, ground: 0x46c04a },
    intro: {
      title: 'Benchmark Kart · MMLU Motorway',
      date: 'Between worlds · Sep 2020',
      lines: [fact('MMLU (September 2020) tests models with multiple-choice questions across 57 subjects, from elementary math to law.', 'mmlu'), CONTROLS, FRIENDS],
    },
  },
  {
    id: 'kart-humaneval',
    afterWorld: 2,
    name: 'HumanEval Circuit',
    length: 560,
    hurdles: 16,
    pads: 6,
    tokens: 18,
    rivals: ['deepseek', 'mistral', 'grok'],
    spotlight: fact('Mistral AI was founded in Paris in 2023. Its first model, Mistral 7B (September 2023), was released under the open Apache 2.0 license.', 'mistralFounded', 'mistral7b'),
    theme: { skyTop: '#6db3f2', skyBottom: '#e0f4ff', road: 0x444a55, stripe: 0xffd166, ground: 0x7cc46b },
    intro: {
      title: 'Benchmark Kart · HumanEval Circuit',
      date: 'Between worlds · Jul 2021',
      lines: [
        fact('HumanEval (July 2021, from the Codex paper) is a set of hand-written Python problems: can the model write a function from its docstring that passes the unit tests?', 'codex'),
        CONTROLS,
        FRIENDS,
      ],
    },
  },
  {
    id: 'kart-swebench',
    afterWorld: 3,
    name: 'SWE-bench Rally',
    length: 600,
    hurdles: 18,
    pads: 7,
    tokens: 20,
    rivals: ['gemini', 'grok', 'llama'],
    spotlight: fact('Grok was announced by xAI on November 4, 2023 as a limited beta, and reached X Premium+ subscribers that December.', 'grok'),
    theme: { skyTop: '#8a5cff', skyBottom: '#ffc0e0', road: 0x3a3450, stripe: 0xffffff, ground: 0x9a7ad8 },
    intro: {
      title: 'Benchmark Kart · SWE-bench Rally',
      date: 'Between worlds · Oct 2023',
      lines: [fact('SWE-bench (October 2023) gives models 2,294 real GitHub issues from 12 Python projects: can the model patch the code so the tests pass?', 'swebench'), CONTROLS, FRIENDS],
    },
  },
  {
    id: 'kart-arc',
    afterWorld: 4,
    name: 'ARC Prize Canyon',
    length: 620,
    hurdles: 20,
    pads: 7,
    tokens: 20,
    rivals: ['llama', 'deepseek', 'gemini'],
    spotlight: fact('Gemini (December 2023) was built by Google "from the ground up to be multimodal", in three sizes: Ultra, Pro and Nano.', 'gemini'),
    theme: { skyTop: '#f4a261', skyBottom: '#ffe8c2', road: 0x5a4032, stripe: 0xfff3d6, ground: 0xc8763a },
    intro: {
      title: 'Benchmark Kart · ARC Prize Canyon',
      date: 'Between worlds · Jun–Nov 2024',
      lines: [
        fact('ARC (2019) is a set of grid puzzles that test learning a new rule from a few examples: easy for people, hard for AI.', 'arc'),
        fact('In the 2024 ARC Prize, the top score rose from 33% to 55.5%, and the $600K grand prize for reaching 85% went unclaimed.', 'arcPrize'),
        CONTROLS,
      ],
    },
  },
  {
    id: 'kart-hle',
    afterWorld: 5,
    name: 'Last Exam Loop',
    length: 640,
    hurdles: 22,
    pads: 8,
    tokens: 22,
    rivals: ['deepseek', 'mistral', 'gemini'],
    spotlight: fact(
      'DeepSeek-V3 (December 2024) is a 671B-parameter mixture-of-experts model; its report put the final training run at about 2.8 million GPU-hours, not counting earlier experiments.',
      'deepseekV3',
    ),
    theme: { skyTop: '#1b1035', skyBottom: '#5a3a8a', road: 0x2a2440, stripe: 0xb07cff, ground: 0x3a2a5a },
    intro: {
      title: 'Benchmark Kart · Last Exam Loop',
      date: 'Between worlds · Jan 2025',
      lines: [
        fact('Humanity’s Last Exam (January 2025) is 2,500 expert-written questions at the edge of human knowledge, built because top models were scoring above 90% on MMLU.', 'hle'),
        CONTROLS,
        FRIENDS,
      ],
    },
  },
  {
    id: 'kart-glue',
    afterWorld: 6,
    name: 'Saturation Speedway',
    length: 680,
    hurdles: 24,
    pads: 8,
    tokens: 24,
    rivals: ['grok', 'llama', 'mistral'],
    spotlight: fact('Llama 2 (July 2023) shipped with open weights, free for research and commercial use, in sizes from 7B to 70B.', 'llama2'),
    theme: { skyTop: '#2a2622', skyBottom: '#c08040', road: 0x4a4c52, stripe: 0xe8c070, ground: 0x6e5a48 },
    intro: {
      title: 'Benchmark Kart · Saturation Speedway',
      date: 'Between worlds · 2018 → 2026',
      lines: [
        fact('GLUE (2018) bundled nine language-understanding tasks into one score. Models soon beat the non-expert human baseline, so SuperGLUE (2019) raised the bar.', 'glue', 'superglue'),
        tip('Benchmarks "saturate": once top models ace a test, researchers build a harder one. This track is every lap of that loop.'),
        CONTROLS,
      ],
    },
  },
];
