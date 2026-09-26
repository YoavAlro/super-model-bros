import type { TuneId } from '../config/music';

/**
 * Pure star-power rules (unit tested in `star.test.ts`): which tune plays, how the rainbow cycles and
 * blinks as the star runs out, the jump somersault, the knock-off arc and the combo ladder.
 * The visuals that use them live in `starFx.ts`.
 */

export type StarKind = 'rlhf' | 'viral' | 'mega';

// ------------------------------------------------------------------- music

export interface TuneState {
  /** The level theme's tune. */
  level: TuneId;
  /** The level is over (flag reached or boss beaten): silence until the outro. */
  over: boolean;
  /** Some player has a star. */
  starred: boolean;
  /** A boss is awake and still standing. */
  bossAwake: boolean;
}

/** The tune that should play now: nothing once the level is over, then star, then boss, then the theme. */
export function pickTune(s: TuneState): TuneId | null {
  if (s.over) return null;
  if (s.starred) return 'star';
  if (s.bossAwake) return 'boss';
  return s.level;
}

// ----------------------------------------------------------------- rainbow

/** The last seconds of a star, when it blinks (or fades, with reduced motion) to warn you. */
export const STAR_WARN = 2;
/** Warning blink rate in full on/off cycles per second: under the 3 Hz photosensitivity limit. */
export const STAR_BLINK_HZ = 2.5;

interface KindLook {
  /** Hue cycles per second when the star is fresh, and when it is about to run out. */
  fast: number;
  slow: number;
  sat: number;
  /** Emissive lightness: the glow. Constant, so the cycle never flashes. */
  glow: number;
}

const LOOKS: Record<StarKind, KindLook> = {
  rlhf: { fast: 1.4, slow: 0.45, sat: 0.95, glow: 0.22 },
  viral: { fast: 1.6, slow: 0.5, sat: 1, glow: 0.2 },
  mega: { fast: 0.7, slow: 0.3, sat: 0.9, glow: 0.24 },
};

export const starSaturation = (kind: StarKind): number => LOOKS[kind].sat;
export const starGlow = (kind: StarKind): number => LOOKS[kind].glow;

/**
 * How fast the rainbow cycles (cycles per second): fast when the star is fresh, slowing as it runs
 * down, and slowest in the warning. Reduced motion: a steady glow (viral drifts very slowly).
 */
export function starCycleRate(kind: StarKind, left: number, total: number, reduceMotion: boolean): number {
  if (reduceMotion) return kind === 'viral' ? 0.05 : 0;
  const { fast, slow } = LOOKS[kind];
  if (left <= STAR_WARN) return slow;
  const f = Math.min(1, Math.max(0, (left - STAR_WARN) / Math.max(0.001, total - STAR_WARN)));
  return slow + (fast - slow) * f;
}

/**
 * How strongly the star colours show (0 = the character's own colours, 1 = full rainbow).
 * Full until the warning; then it blinks at STAR_BLINK_HZ, or with reduced motion fades out smoothly.
 */
export function starMix(left: number, reduceMotion: boolean): number {
  if (left <= 0) return 0;
  if (left > STAR_WARN) return 1;
  if (reduceMotion) return left / STAR_WARN;
  return Math.floor(left * STAR_BLINK_HZ * 2) % 2 === 0 ? 1 : 0;
}

/**
 * The hue (0..1) of one part of a starred character. `phase` is the accumulated cycle count and
 * `offset` the part's height on the body (0 at the feet, 1 at the top), so the colours ripple
 * upward. RLHF leans gold, viral runs the whole rainbow, the frontier giant glows gold.
 */
export function starHue(kind: StarKind, phase: number, offset: number): number {
  const wave = (spread: number) => Math.sin(2 * Math.PI * (phase + offset * spread));
  let h: number;
  if (kind === 'viral') h = phase + offset * 0.55;
  else if (kind === 'rlhf') h = 0.115 + 0.05 * wave(0.5);
  else h = 0.12 + 0.022 * wave(0.3);
  return ((h % 1) + 1) % 1;
}

/**
 * Lightness of a part while starred: its own lightness pulled halfway to the middle. It depends only
 * on the part, never on time, so the hue cycle runs at constant lightness (no strobing).
 */
export const starLightness = (own: number): number => 0.5 + (own - 0.5) * 0.45;

/** How strongly a part takes the star colour: eyes, highlights and ink lines mostly keep theirs. */
export const starWeight = (own: number): number => (own > 0.9 || own < 0.12 ? 0.35 : 1);

// -------------------------------------------------------------- somersault

/** Seconds of the rise after a jump (clamped so tiny hops and moon jumps still flip nicely). */
export function spinDuration(jumpVelocity: number, gravity: number): number {
  return Math.min(0.6, Math.max(0.28, jumpVelocity / Math.max(1, gravity)));
}

/** The somersault angle (0..2π) `elapsed` seconds into the rise, eased in and out; 0 once done. */
export function spinAngle(elapsed: number, duration: number): number {
  if (elapsed <= 0 || elapsed >= duration) return 0;
  const u = elapsed / duration;
  return 2 * Math.PI * u * u * (3 - 2 * u);
}

// ------------------------------------------------------------- knock-offs

export const KNOCK = {
  /** Pop-up speed, sideways drift (away from the player) and gravity of a knocked-off enemy. */
  vy: 14,
  vx: 3.6,
  gravity: 36,
  /** Seconds to flip upside down. */
  flip: 0.14,
  /** Spin around its own up axis, and the slow roll it keeps after the flip (radians per second). */
  spin: 10,
  roll: 2.2,
  /** Hidden after this long or this far below where it was hit, whichever comes first. */
  maxAge: 3,
  maxDrop: 16,
};

export interface KnockPose {
  dx: number;
  dy: number;
  /** Roll in the screen plane: π is upside down. */
  roll: number;
  /** Spin around its own vertical axis. */
  spin: number;
  done: boolean;
}

/**
 * Where a knocked-off enemy is `age` seconds after the hit; `dir` is ±1, away from the player.
 * Pass `out` to fill an existing pose instead of allocating one.
 */
export function knockPose(age: number, dir: number, out: KnockPose = { dx: 0, dy: 0, roll: 0, spin: 0, done: false }): KnockPose {
  const dy = KNOCK.vy * age - 0.5 * KNOCK.gravity * age * age;
  const f = Math.min(1, age / KNOCK.flip);
  const flip = Math.PI * f * f * (3 - 2 * f);
  out.dx = dir * KNOCK.vx * age;
  out.dy = dy;
  out.roll = -dir * (flip + KNOCK.roll * Math.max(0, age - KNOCK.flip));
  out.spin = KNOCK.spin * age;
  out.done = age >= KNOCK.maxAge || dy < -KNOCK.maxDrop;
  return out;
}

// ------------------------------------------------------------------ combos

/** Points for the n-th enemy knocked off by one star: doubling from 100, capped at 6400. */
export const comboPoints = (n: number): number => 100 * 2 ** Math.min(Math.max(0, n - 1), 6);

const COMBO_COLORS = ['#ffffff', '#ffe066', '#ffb347', '#ff8fb8', '#d59bff', '#8fd8ff', '#8dffb8'];

/** The popup's text colour, warming up the chain. */
export const comboColor = (n: number): string => COMBO_COLORS[Math.min(Math.max(0, n - 1), COMBO_COLORS.length - 1)];

/** The popup's text: the points, and the chain length once it is a chain. */
export const comboLabel = (n: number): string => (n >= 2 ? `${comboPoints(n)} ×${n}` : `${comboPoints(n)}`);
