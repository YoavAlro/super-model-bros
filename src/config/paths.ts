import type { CharacterId } from './characters';
import type { FactCard } from './types';
import { fact, tip } from './types';

export type PathId = 'gpt' | 'claude';

/** A level in a path. `when` makes it conditional on a run flag (e.g. a storm triggered by an earlier choice). */
export interface PathStep {
  level: string;
  when?: string;
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
    steps: [
      { level: 'gpt-1-1' },
      { level: 'gpt-1-2' },
      { level: 'gpt-1-3' },
      { level: 'gpt-2-1' },
      { level: 'gpt-2-2' },
      { level: 'gpt-3-1' },
      { level: 'gpt-3-2' },
      { level: 'gpt-3-3' },
    ],
  },
  claude: {
    id: 'claude',
    name: 'Claude path',
    hero: 'claude',
    partner: 'gpt',
    startForm: 'Research model',
    steps: [{ level: 'claude-2-1' }, { level: 'claude-2-2' }, { level: 'claude-3-1' }, { level: 'claude-3-2' }, { level: 'claude-3-3' }],
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
