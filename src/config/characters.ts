export type CharacterId = 'gpt' | 'claude' | 'gemini' | 'llama' | 'deepseek' | 'mistral' | 'grok';

/** What makes a character play differently. See `docs/cast.md`. */
export type TraitKind = 'balanced' | 'float' | 'seeHidden' | 'dropCopy' | 'efficient' | 'airDash' | 'cloud';

export interface CharacterSpec {
  id: CharacterId;
  name: string;
  lab: string;
  color: number;
  accent: number;
  walkSpeed: number;
  runSpeed: number;
  jumpVelocity: number;
  /** Gravity while rising. */
  gravity: number;
  /** Gravity while falling. Lower = floatier. */
  fallGravity: number;
  /** Multiplies acceleration. */
  accel?: number;
  traitKind: TraitKind;
  /** One line shown on the character select screen. */
  trait: string;
  /** How to unlock it, shown on locked roster cards; null when playable from the start. */
  unlock: string | null;
  /** The rule checked after every level (see `checkUnlocks` in `src/game/progress.ts`). */
  unlockRule?: UnlockRule;
}

export type UnlockRule =
  /** Finish the last level of this world on either path. */
  | { kind: 'beatWorld'; world: number }
  /** Earn three history stars on every level of this world on one path. */
  | { kind: 'allStars'; world: number };

export const CHARACTERS: Record<CharacterId, CharacterSpec> = {
  gpt: {
    id: 'gpt',
    traitKind: 'balanced',
    name: 'GPT',
    lab: 'OpenAI',
    color: 0x10a37f,
    accent: 0xf4f4f4,
    walkSpeed: 8.5,
    runSpeed: 13,
    jumpVelocity: 23,
    gravity: 62,
    fallGravity: 66,
    trait: 'The famous brother. Balanced, fast, a household name since 2022.',
    unlock: null,
  },
  claude: {
    id: 'claude',
    traitKind: 'float',
    name: 'Claude',
    lab: 'Anthropic',
    color: 0xd97757,
    accent: 0xf5ecd7,
    walkSpeed: 8,
    runSpeed: 12.5,
    jumpVelocity: 24,
    gravity: 60,
    fallGravity: 44,
    trait: 'The brother who left home in 2021. Jumps higher and floats longer: long context, long hang time.',
    unlock: null,
  },
  gemini: {
    id: 'gemini',
    traitKind: 'seeHidden',
    name: 'Gemini',
    lab: 'Google',
    color: 0x4c8df6,
    accent: 0xffffff,
    walkSpeed: 8.5,
    runSpeed: 12.5,
    jumpVelocity: 23,
    gravity: 62,
    fallGravity: 60,
    trait: 'Multimodal eyes: sees hidden blocks.',
    unlock: 'Beat World 3',
    unlockRule: { kind: 'beatWorld', world: 3 },
  },
  llama: {
    id: 'llama',
    traitKind: 'dropCopy',
    name: 'Llama',
    lab: 'Meta',
    color: 0x7b61ff,
    accent: 0xffffff,
    walkSpeed: 8.5,
    runSpeed: 12.5,
    jumpVelocity: 23,
    gravity: 62,
    fallGravity: 62,
    trait: 'Open weights: press the power button to drop a copy of itself that helps.',
    unlock: 'Beat World 4',
    unlockRule: { kind: 'beatWorld', world: 4 },
  },
  deepseek: {
    id: 'deepseek',
    traitKind: 'efficient',
    name: 'DeepSeek',
    lab: 'DeepSeek',
    color: 0x4d6bfe,
    accent: 0xffffff,
    walkSpeed: 9,
    runSpeed: 14,
    jumpVelocity: 22.5,
    gravity: 62,
    fallGravity: 64,
    accel: 1.5,
    trait: 'Efficient: gets up to speed on less compute, and runs faster.',
    unlock: 'Beat World 5',
    unlockRule: { kind: 'beatWorld', world: 5 },
  },
  mistral: {
    id: 'mistral',
    traitKind: 'airDash',
    name: 'Mistral',
    lab: 'Mistral AI',
    color: 0xfa520f,
    accent: 0xffd800,
    walkSpeed: 9,
    runSpeed: 13.5,
    jumpVelocity: 22.5,
    gravity: 62,
    fallGravity: 62,
    trait: 'A strong wind: press run in mid-air to dash.',
    unlock: 'Earn every history star in World 2',
    unlockRule: { kind: 'allStars', world: 2 },
  },
  grok: {
    id: 'grok',
    traitKind: 'cloud',
    name: 'Grok',
    lab: 'xAI',
    color: 0x9a9a9a,
    accent: 0xffffff,
    walkSpeed: 8.5,
    runSpeed: 13,
    jumpVelocity: 23,
    gravity: 62,
    fallGravity: 62,
    trait: 'Rides the Timeline cloud: press the power button to summon one.',
    unlock: 'Beat World 6',
    unlockRule: { kind: 'beatWorld', world: 6 },
  },
};

export const ROSTER = Object.values(CHARACTERS);
