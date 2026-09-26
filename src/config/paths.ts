import type { CharacterId } from './characters';
import type { FactCard, FactLine } from './types';
import { fact, tip } from './types';

export type PathId = 'gpt' | 'claude';

/** A level in a path. `when` makes it conditional on a run flag (e.g. a storm triggered by an earlier choice). */
export interface PathStep {
  level: string;
  when?: string;
  /** Shown on the story timeline next to a conditional step. */
  note?: string;
}

export interface PathSpec {
  id: PathId;
  name: string;
  /** The brother whose models this path follows. */
  hero: CharacterId;
  /** Co-op partner. */
  partner: CharacterId;
  /** Name tag before the first level. */
  startForm: string;
  /** Where the story starts, before the first level (the first row of the story timeline). */
  origin: { name: string; date: string; line: FactLine };
  steps: PathStep[];
  /** Shown once, before the first level. */
  prologue?: FactCard;
}

export const PATHS: Record<PathId, PathSpec> = {
  gpt: {
    id: 'gpt',
    name: 'GPT path',
    hero: 'gpt',
    partner: 'claude',
    startForm: 'Transformer',
    origin: {
      name: 'Transformer',
      date: 'Jun 2017',
      line: fact('Google researchers introduced the Transformer in "Attention Is All You Need".', 'transformer'),
    },
    steps: [
      { level: 'gpt-1-1' },
      { level: 'gpt-1-2' },
      { level: 'gpt-1-3' },
      { level: 'gpt-2-1' },
      { level: 'gpt-2-2' },
      { level: 'gpt-3-1' },
      { level: 'gpt-3-2' },
      { level: 'gpt-3-3' },
      { level: 'gpt-4-1' },
      { level: 'gpt-4-2' },
      { level: 'gpt-4-3' },
      { level: 'gpt-5-1' },
      { level: 'gpt-5-2' },
      { level: 'gpt-5-3' },
      { level: 'gpt-5-4' },
      { level: 'gpt-6-1' },
      { level: 'gpt-6-2' },
      { level: 'gpt-6-3' },
      { level: 'gpt-6-4' },
      { level: 'gpt-7-1' },
      { level: 'gpt-7-2' },
    ],
  },
  claude: {
    id: 'claude',
    name: 'Claude path',
    hero: 'claude',
    partner: 'gpt',
    startForm: 'Research model',
    origin: {
      name: 'Anthropic',
      date: '2021',
      line: fact('A group of former OpenAI researchers founded Anthropic, an AI safety and research company.', 'anthropicFounded'),
    },
    steps: [
      { level: 'claude-2-1' },
      { level: 'claude-2-2' },
      { level: 'claude-3-1' },
      { level: 'claude-3-2' },
      { level: 'claude-3-3' },
      { level: 'claude-4-1' },
      { level: 'claude-4-2' },
      { level: 'claude-4-3' },
      { level: 'claude-5-1' },
      { level: 'claude-5-2' },
      { level: 'claude-5-3' },
      { level: 'claude-5-4', when: 'shadowBooks', note: 'Only on runs that take Shadow library tokens' },
      { level: 'claude-5-5' },
      { level: 'claude-6-1' },
      { level: 'claude-6-2' },
      { level: 'claude-6-3' },
      { level: 'claude-6-4' },
      { level: 'claude-7-1' },
      { level: 'claude-7-2' },
      { level: 'claude-7-3' },
    ],
    prologue: {
      title: 'The Claude path',
      date: '2021 · World 2 · Alignment Hills',
      lines: [
        fact('In 2021, a group of former OpenAI researchers founded Anthropic. That is where your story starts.', 'anthropicFounded'),
        tip('Claude jumps higher and floats longer than GPT: long context, long hang time.'),
      ],
    },
  },
};

export const PATH_IDS = Object.keys(PATHS) as PathId[];
