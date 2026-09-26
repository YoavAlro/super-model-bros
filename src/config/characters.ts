export type CharacterId = 'gpt' | 'claude' | 'gemini' | 'llama' | 'deepseek' | 'mistral' | 'grok';

/** What makes a character play differently. See `docs/cast.md`. */
export type TraitKind = 'balanced' | 'float' | 'seeHidden' | 'dropCopy' | 'efficient' | 'airDash' | 'cloud';

/**
 * Part colours for each mascot body plan (drawn by `src/game/characterMeshes.ts`). The body itself
 * is always the character's `color`.
 */
export interface PlanColors {
  /** A walking speech bubble with a cowlick. */
  chatBubble: { curl: number; legs: number; sneakers: number; tongue: number; lines: number };
  /** A tall soft block with an ink face page and a long scarf. */
  scarfBlock: { page: number; stripe: number; legs: number; blush: number; vane: number; spine: number; nib: number };
  /** Twin domes, one per twin, over a body blended from one twin's colour to the other's. */
  twinDomes: { twin: number; twinIris: number; bow: number; feet: number; blush: number; freckles: number };
  /** An upright llama: wool below, a long cream neck and banana ears above. */
  openLlama: { cream: number; snout: number; collar: number; charm: number; innerEar: number; hooves: number };
  /** An upright whale calf with a spout. */
  whaleCalf: { fins: number; belly: number; pleats: number; dark: number; spout: number; droplets: number; blush: number };
  /** A cat in a smooth gradient (body colour at the feet, `mid`, then `crown`) with a gust-curl tail. */
  galeCat: { mid: number; crown: number; tail: number; tailTip: number; cream: number; scarf: number; nose: number };
  /** A bobble-headed space cadet: helmet, visor, suit and a towel. */
  spaceCadet: { visor: number; suit: number; trim: number; mitts: number; light: number; towel: number; bands: number; patch: number };
}

export type BodyPlan = keyof PlanColors;

/** How a character is drawn: its body plan, its own iris colour, and its part colours. */
export type CharacterLook = { [P in BodyPlan]: { plan: P; iris: number; colors: PlanColors[P] } }[BodyPlan];

export interface CharacterSpec {
  id: CharacterId;
  name: string;
  lab: string;
  color: number;
  accent: number;
  /** The mascot's look. Colours and motifs are nods, never logos. */
  look: CharacterLook;
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
    look: { plan: 'chatBubble', iris: 0x0b3d2e, colors: { curl: 0x0b7a5f, legs: 0x0b3d2e, sneakers: 0xf4f4f4, tongue: 0xff8a8a, lines: 0xc4f1df } },
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
    look: { plan: 'scarfBlock', iris: 0x5a3322, colors: { page: 0xf5ecd7, stripe: 0x3d3929, legs: 0xb85f42, blush: 0xf2a48a, vane: 0xfffaf0, spine: 0xa4513a, nib: 0x3b2a22 } },
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
    look: { plan: 'twinDomes', iris: 0x2446a8, colors: { twin: 0x9b72cb, twinIris: 0x6a3fb0, bow: 0xd96570, feet: 0x2f3a6b, blush: 0xffb3c7, freckles: 0xfff6c8 } },
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
    look: { plan: 'openLlama', iris: 0x2a1a6e, colors: { cream: 0xf3eefe, snout: 0xffffff, collar: 0x0866ff, charm: 0xffd166, innerEar: 0xd9ccff, hooves: 0x2a1a4e } },
    walkSpeed: 8.5,
    runSpeed: 12.5,
    jumpVelocity: 23,
    gravity: 62,
    fallGravity: 62,
    trait: 'Open weights: press the power button to drop a copy of itself. It holds switches, and you can stand on its head.',
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
    look: { plan: 'whaleCalf', iris: 0x13235e, colors: { fins: 0x3a54d6, belly: 0xf2f6ff, pleats: 0xb9c6ff, dark: 0x2b3fb3, spout: 0xbfe6ff, droplets: 0xd9f3ff, blush: 0xffa8c8 } },
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
    look: { plan: 'galeCat', iris: 0x1a8f5a, colors: { mid: 0xff8205, crown: 0xffaf00, tail: 0xffd800, tailTip: 0xfff6d0, cream: 0xfff1c9, scarf: 0xe10500, nose: 0xff6f91 } },
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
    look: { plan: 'spaceCadet', iris: 0x1d1424, colors: { visor: 0x16181d, suit: 0x3a3d44, trim: 0xf4f4f4, mitts: 0xd6d8dc, light: 0x9ff7ff, towel: 0xf2eee3, bands: 0x7d8088, patch: 0xc1440e } },
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
