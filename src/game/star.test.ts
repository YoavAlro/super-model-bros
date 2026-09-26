import { describe, expect, it } from 'vitest';
import { TUNES } from '../config/music';
import { parseMelody } from './musicTheory';
import {
  STAR_BLINK_HZ,
  STAR_WARN,
  comboColor,
  comboLabel,
  comboPoints,
  knockPose,
  pickTune,
  spinAngle,
  spinDuration,
  starCycleRate,
  starHue,
  starLightness,
  starMix,
  starWeight,
  type StarKind,
} from './starRules';

const KINDS: StarKind[] = ['rlhf', 'viral', 'mega'];

describe('star music', () => {
  const base = { level: 'overworld', over: false, starred: false, bossAwake: false } as const;

  it('plays the level theme, the boss tune while a boss is up, and the star tune over both', () => {
    expect(pickTune(base)).toBe('overworld');
    expect(pickTune({ ...base, bossAwake: true })).toBe('boss');
    expect(pickTune({ ...base, starred: true })).toBe('star');
    expect(pickTune({ ...base, starred: true, bossAwake: true })).toBe('star');
  });

  it('hands back to whatever should play when the star ends', () => {
    expect(pickTune({ ...base, level: 'castle', starred: false })).toBe('castle');
    expect(pickTune({ ...base, level: 'castle', starred: false, bossAwake: true })).toBe('boss');
  });

  it('goes quiet once the level is over, star or not', () => {
    expect(pickTune({ ...base, over: true })).toBeNull();
    expect(pickTune({ ...base, over: true, starred: true, bossAwake: true })).toBeNull();
  });

  it('ships a fast, original star loop that fills its bars', () => {
    const star = TUNES.star;
    expect(star.bpm).toBeGreaterThan(Math.max(...Object.values(TUNES).filter((t) => t !== star).map((t) => t.bpm)));
    expect(parseMelody(star.melody).steps).toBe(star.chords.length * 8);
  });
});

describe('star rainbow', () => {
  it('cycles fast when fresh and slower as it runs down', () => {
    for (const kind of KINDS) {
      const fresh = starCycleRate(kind, 10, 10, false);
      const mid = starCycleRate(kind, 6, 10, false);
      const warn = starCycleRate(kind, 1, 10, false);
      expect(fresh, kind).toBeGreaterThan(mid);
      expect(mid, kind).toBeGreaterThan(warn);
      expect(warn, kind).toBeGreaterThan(0);
    }
  });

  it('shows full colour until the warning, then blinks no faster than 3 Hz', () => {
    expect(starMix(STAR_WARN + 0.01, false)).toBe(1);
    expect(starMix(0, false)).toBe(0);
    expect(STAR_BLINK_HZ).toBeLessThanOrEqual(3);
    // Count on/off changes over the warning, sampled finely.
    let changes = 0;
    let prev = starMix(STAR_WARN, false);
    for (let left = STAR_WARN; left > 0; left -= 0.001) {
      const now = starMix(left, false);
      if (now !== prev) changes++;
      prev = now;
    }
    // Two changes make one flash: at most 3 flashes per second.
    expect(changes / 2 / STAR_WARN).toBeLessThanOrEqual(3);
    expect(changes).toBeGreaterThanOrEqual(6);
  });

  it('with reduced motion: a steady glow that fades out instead of blinking', () => {
    expect(starCycleRate('rlhf', 8, 8, true)).toBe(0);
    expect(starCycleRate('mega', 8, 12, true)).toBe(0);
    expect(starCycleRate('viral', 10, 10, true)).toBeLessThan(0.1);
    let prev = starMix(STAR_WARN, true);
    for (let left = STAR_WARN; left > 0; left -= 0.01) {
      const now = starMix(left, true);
      expect(now).toBeLessThanOrEqual(prev);
      prev = now;
    }
  });

  it('keeps each part at one lightness, so the cycle never strobes', () => {
    for (const own of [0, 0.1, 0.3, 0.5, 0.8, 1]) {
      const l = starLightness(own);
      expect(l).toBeGreaterThanOrEqual(0.25);
      expect(l).toBeLessThanOrEqual(0.75);
    }
    // Ordering survives: dark parts stay darker than light ones.
    expect(starLightness(0.1)).toBeLessThan(starLightness(0.9));
    // Eyes and ink lines mostly keep their colour; the body takes it fully.
    expect(starWeight(1)).toBeLessThan(1);
    expect(starWeight(0.05)).toBeLessThan(1);
    expect(starWeight(0.5)).toBe(1);
  });

  it('leans gold for RLHF and the frontier giant, and runs the whole rainbow when viral', () => {
    const hues = (kind: StarKind) => Array.from({ length: 200 }, (_, i) => starHue(kind, i / 50, (i % 7) / 6));
    for (const kind of ['rlhf', 'mega'] as const) {
      for (const h of hues(kind)) {
        expect(h, kind).toBeGreaterThan(0.05);
        expect(h, kind).toBeLessThan(0.18);
      }
    }
    const viral = hues('viral');
    expect(Math.max(...viral) - Math.min(...viral)).toBeGreaterThan(0.9);
    for (const h of viral) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe('star somersault', () => {
  it('turns once through the rise, eased, and stops at the apex', () => {
    const d = spinDuration(23, 62);
    expect(d).toBeCloseTo(23 / 62);
    expect(spinAngle(0, d)).toBe(0);
    expect(spinAngle(d, d)).toBe(0);
    expect(spinAngle(d / 2, d)).toBeCloseTo(Math.PI);
    let prev = 0;
    for (let t = 0.001; t < d; t += 0.005) {
      const a = spinAngle(t, d);
      expect(a).toBeGreaterThanOrEqual(prev);
      expect(a).toBeLessThanOrEqual(2 * Math.PI);
      prev = a;
    }
    expect(spinDuration(100, 10)).toBeLessThanOrEqual(0.6);
    expect(spinDuration(1, 100)).toBeGreaterThanOrEqual(0.28);
  });
});

describe('star knock-offs', () => {
  it('flip upside down, pop up, drift away from the player and fall off the screen', () => {
    const start = knockPose(0, 1);
    expect(start.dy).toBe(0);
    expect(Math.abs(start.roll)).toBe(0);
    const flipped = knockPose(0.2, 1);
    expect(Math.abs(flipped.roll)).toBeGreaterThanOrEqual(Math.PI);
    expect(flipped.dy).toBeGreaterThan(0);
    expect(flipped.dx).toBeGreaterThan(0);
    expect(knockPose(0.2, -1).dx).toBeLessThan(0);
    expect(knockPose(0.3, 1).spin).toBeGreaterThan(knockPose(0.1, 1).spin);
    // It falls out of sight within a couple of seconds.
    let t = 0;
    while (!knockPose(t, 1).done) t += 0.01;
    expect(t).toBeGreaterThan(1);
    expect(t).toBeLessThan(3.01);
    expect(knockPose(t, 1).dy).toBeLessThan(-10);
  });

  it('scores an escalating chain', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(comboPoints)).toEqual([100, 200, 400, 800, 1600, 3200, 6400]);
    expect(comboPoints(20)).toBe(6400);
    expect(comboLabel(1)).toBe('100');
    expect(comboLabel(3)).toBe('400 ×3');
    expect(comboColor(1)).not.toBe(comboColor(4));
    expect(comboColor(99)).toBe(comboColor(7));
  });
});
