export type CharacterId = 'gpt' | 'claude' | 'gemini' | 'llama' | 'deepseek' | 'mistral' | 'grok';

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
  /** One line shown on the character select screen. */
  trait: string;
  /** How to unlock it, or null when playable from the start. */
  unlock: string | null;
}

export const CHARACTERS: Record<CharacterId, CharacterSpec> = {
  gpt: {
    id: 'gpt',
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
  },
  llama: {
    id: 'llama',
    name: 'Llama',
    lab: 'Meta',
    color: 0x7b61ff,
    accent: 0xffffff,
    walkSpeed: 8.5,
    runSpeed: 12.5,
    jumpVelocity: 23,
    gravity: 62,
    fallGravity: 62,
    trait: 'Open weights: can drop a copy of itself to help.',
    unlock: 'Beat World 4',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    lab: 'DeepSeek',
    color: 0x4d6bfe,
    accent: 0xffffff,
    walkSpeed: 9,
    runSpeed: 14,
    jumpVelocity: 22.5,
    gravity: 62,
    fallGravity: 64,
    trait: 'Efficient: runs further on less compute.',
    unlock: 'Beat World 5',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    lab: 'Mistral AI',
    color: 0xfa520f,
    accent: 0xffd800,
    walkSpeed: 9,
    runSpeed: 13.5,
    jumpVelocity: 22.5,
    gravity: 62,
    fallGravity: 62,
    trait: 'A strong wind: air dash.',
    unlock: 'Earn every history star in World 2',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    lab: 'xAI',
    color: 0x9a9a9a,
    accent: 0xffffff,
    walkSpeed: 8.5,
    runSpeed: 13,
    jumpVelocity: 23,
    gravity: 62,
    fallGravity: 62,
    trait: 'Rides the Timeline cloud.',
    unlock: 'Beat World 6',
  },
};

export const ROSTER = Object.values(CHARACTERS);
