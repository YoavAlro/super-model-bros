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
  /** Every hero is down, waiting to respawn: quiet under the die sound, and the tune starts fresh after. */
  down: boolean;
}

/**
 * The tune that should play now: nothing once the level is over or while every hero is down, then
 * star, then boss, then the theme.
 */
export function pickTune(s: TuneState): TuneId | null {
  if (s.over || s.down) return null;
  if (s.starred) return 'star';
  if (s.bossAwake) return 'boss';
  return s.level;
}

// ----------------------------------------------------------------- rainbow

/** The last seconds of a star, when it blinks (or fades, with reduced motion) to warn you. */
export const STAR_WARN = 2;
/** Warning blink rate in full on/off cycles per second. */
export const STAR_BLINK_HZ = 2.5;
/** Hue cycles per second during the warning: barely drifting, so the blink is the flash that counts. */
export const STAR_WARN_DRIFT = 0.15;
/**
 * The photosensitivity limit: no more than 3 flashes a second. `starLift` keeps dark hues from
 * dipping below a grey of the part's lightness, but a hue sweep still brightens toward yellow, so each
 * full hue cycle can read as a flash. What keeps it safe is the rate: every cycle rate, and the warning
 * blink plus the drift under it, stay under this.
 */
export const FLASH_LIMIT_HZ = 3;

interface KindLook {
  /** Hue cycles per second when the star is fresh, and when it is about to run out. */
  fast: number;
  slow: number;
  sat: number;
  /** Emissive HSL lightness: the glow. */
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
 * down, and barely drifting in the warning. Reduced motion: a steady glow (viral drifts very slowly).
 */
export function starCycleRate(kind: StarKind, left: number, total: number, reduceMotion: boolean): number {
  if (reduceMotion) return kind === 'viral' ? 0.05 : 0;
  const { fast, slow } = LOOKS[kind];
  if (left <= STAR_WARN) return Math.min(slow, STAR_WARN_DRIFT);
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
 * HSL lightness of a part while starred: its own lightness pulled halfway to the middle. It depends
 * only on the part, never on time, so the cycle never pulses light and dark on its own; `starLift`
 * then raises it for the dark hues.
 */
export const starLightness = (own: number): number => 0.5 + (own - 0.5) * 0.45;

/** An sRGB channel (0..1) in linear light. */
const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** One sRGB channel of an HSL colour (the same maths as three.js `Color.setHSL`). */
function hslChannel(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}

/** Relative luminance (0 black .. 1 white) of the sRGB colour with these HSL components. */
export function hslLuminance(h: number, s: number, l: number): number {
  h = ((h % 1) + 1) % 1;
  const q = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return 0.2126 * toLinear(hslChannel(p, q, h + 1 / 3)) + 0.7152 * toLinear(hslChannel(p, q, h)) + 0.0722 * toLinear(hslChannel(p, q, h - 1 / 3));
}

/**
 * The lightness to draw hue `h` at in place of `l`: `l` itself, or just enough more that the colour is
 * no darker than a grey of lightness `l`. At the middle HSL lightness blue is under a tenth as bright as yellow, so
 * without this the viral rainbow's blue phase is a dark blob on dark levels; gold never needs a lift.
 */
export function starLift(h: number, s: number, l: number): number {
  const floor = toLinear(l);
  if (hslLuminance(h, s, l) >= floor) return l;
  let lo = l;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (hslLuminance(h, s, mid) >= floor) hi = mid;
    else lo = mid;
  }
  return hi;
}

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

/** A popup's box: its middle and its size. */
export interface PopupBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The height for a new combo popup that would sit at `box.y`: raised above every live popup it would
 * overlap, so a quick chain's popups stack instead of covering each other. Live popups ease to a stop
 * while a new one starts rising, so a stack only spreads apart afterwards.
 */
export function stackPopup(box: PopupBox, live: readonly PopupBox[], gap = 0.08): number {
  let y = box.y;
  // Each pass that moves it clears at least one more popup, so live.length + 1 passes always settle.
  for (let pass = 0; pass <= live.length; pass++) {
    let moved = false;
    for (const o of live) {
      const clear = (o.h + box.h) / 2 + gap;
      // `top` is compared as computed, so a popup just raised onto it never counts as overlapping again.
      const top = o.y + clear;
      if (Math.abs(o.x - box.x) < (o.w + box.w) / 2 + gap && y < top && y > o.y - clear) {
        y = top;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return y;
}

/** Points for the n-th enemy knocked off by one star: doubling from 100, capped at 6400. */
export const comboPoints = (n: number): number => 100 * 2 ** Math.min(Math.max(0, n - 1), 6);

const COMBO_COLORS = ['#ffffff', '#ffe066', '#ffb347', '#ff8fb8', '#d59bff', '#8fd8ff', '#8dffb8'];

/** The popup's text colour, warming up the chain. */
export const comboColor = (n: number): string => COMBO_COLORS[Math.min(Math.max(0, n - 1), COMBO_COLORS.length - 1)];

/** The popup's text: just the points, which climb (with the colour) as the chain grows. */
export const comboLabel = (n: number): string => `${comboPoints(n)}`;
