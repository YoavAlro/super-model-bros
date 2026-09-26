import type { DataTypeId } from './dataTypes';
import type { HypeId, MomentId, StormId } from './events';
import type { ThemeId } from './themes';
import type { FactCard, Mix } from './types';

/** What `*` blocks release. */
export type PowerId = 'rlhf' | 'viral' | 'tool' | 'cape' | 'fork' | 'mega';

export type BossId = 'garbage' | 'rewardHacker' | 'danSydney' | 'injectionPiranha' | 'hallucinationKing' | 'rogueSwarm' | 'paperclip';

/** Level-specific set pieces. */
export type SetPiece =
  /** Viral stars fall from the sky while the camera is between these columns. */
  | { kind: 'starRain'; from: number; to: number; every: number }
  /** Toggle blocks swap every `period` seconds ("at capacity": platforms freeze and unfreeze). */
  | { kind: 'toggles'; period: number; toast?: string };

/**
 * Bonus puzzles built from marks (digits) in the map. Solving one opens the level's gates (`D`).
 * - strawberry: mark `1` sits above the first of ten `X` letter blocks spelling the word.
 * - namingMaze: marks sit on the tile above each pipe's top (on the pipe's left column).
 * - chartCrime: marks sit above each bar (a two-wide pillar of `X`); stomp the bar that lies.
 * - cave: stepping onto a `7` sends you back to the `8`, until you find the way through.
 * - forkPlates: every `1` is a floor plate; they must all be held down at once (by forks or a co-op partner).
 */
export type PuzzleSpec =
  | { kind: 'strawberry'; word: string; tokens: string[]; letter: string }
  | { kind: 'namingMaze'; pipes: Record<string, { label: string; order: number | null }> }
  | { kind: 'chartCrime'; bars: Record<string, { label: string; lies?: boolean; fixedHeight?: number }> }
  | { kind: 'cave' }
  | { kind: 'forkPlates' };

/** Abilities that come with the model you are in this level (your "form"). */
export interface FormAbility {
  /** Sees and stands on hidden blocks (vision, multimodal). */
  vision?: boolean;
  /** Longer context: multiplies jump velocity. */
  jump?: number;
  /** Longer context: multiplies fall gravity (lower = floatier). */
  float?: number;
  /** Three model sizes; the power button cycles them. Names from small to large. */
  sizes?: [string, string, string];
}

export interface LevelSpec {
  /** Unique id, path-qualified: `gpt-2-1`, `claude-2-1`. */
  id: string;
  /** Shown to the player: `2-1`. */
  label: string;
  world: number;
  name: string;
  theme: ThemeId;
  /** The model you become by finishing the level. */
  toward: { name: string; paramsLabel?: string };
  /**
   * `published`: the recipe is the documented training data for this step.
   * `focus`: the lab did not publish a mix, so the recipe is the ingredients that were new at this step.
   */
  recipeKind: 'published' | 'focus';
  recipe: Mix;
  /** What `?` blocks release. */
  blockToken: DataTypeId;
  /** What `*` blocks release. */
  power?: PowerId;
  boss?: BossId;
  /** A storm level: its timed danger comes from `STORMS`. */
  storm?: StormId;
  setPieces?: SetPiece[];
  /** The Timeline's mood: hype (hot takes) or backlash (the red cloud). */
  timeline?: 'hype' | 'backlash';
  /** What `$` blocks release, in order (one hype per block). */
  hypes?: HypeId[];
  puzzle?: PuzzleSpec;
  /** What `!` blocks release (a Moment item, like Golden Gate Claude). */
  moment?: MomentId;
  /** Moments that shape the whole level (the em dash trail, Code Red, #keep4o...). */
  moments?: MomentId[];
  /** Column ranges where a Moment applies (Winter Laziness). */
  zones?: { from: number; to: number; moment: MomentId }[];
  /** What `U` blocks are: a Tibo Reset (2026) or a plain checkpoint (+1 life). */
  oneUp?: 'tibo' | 'checkpoint';
  ability?: FormAbility;
  /** Shown before the level starts. */
  intro: FactCard;
  /** Shown at the flag (or when the boss falls). */
  outro: FactCard;
  /**
   * Which card's first fact line sums the level up on the story timeline. Default `outro`; set `intro`
   * when the outro opens on the enemy or the boss rather than the release. (Storm levels use their intro.)
   */
  headline?: 'intro' | 'outro';
  /**
   * Legend. Tiles: `#` ground, `X` hard, `B` brick, `P` pipe, `=` one-way platform, `>`/`<` conveyor,
   * `[`/`]` toggle blocks, `:` hidden block, `^` spikes, `L` lava, `D` gate.
   * Blocks: `?` token, `M` Scale crystal, `*` the level's power, `$` hype, `U` Tibo Reset 1-Up, `!` moment.
   * Spawns: `S` start, `F` flag, `G` boss, `H` helper, `+` heart, `~` moving platform, `T` the Timeline.
   * Enemies: `e` Spambot, `j` Jailbreaker, `g` hallucination ghost, `p` injection piranha, `r` reward orb,
   * `l` copyright lawyer, `z` rate limit (a crusher: put it on the tile under a ceiling, two free tiles wide),
   * `y` praise coin, `d` runaway agent, `i` paperclip.
   * Tokens: `o` Books, `w` Web, `k` Wikipedia, `c` Code, `f` Human Feedback, `n` Principles, `v` Images,
   * `t` Reasoning, `u` Tool use, `a` Agent tasks, `m` Audio, `s` Shadow library.
   * Digits are level-specific markers.
   * Physics (weakest character): a standing jump clears 3 tiles and a running jump 4; never ask for 5.
   */
  map: string[];
}
