import { describe, expect, it } from 'vitest';
import { HYPES, MOMENTS, STORMS } from '../config/events';
import { ALL_LEVELS } from '../config/levels';
import { addPerk, bankReset, codeRedPar, hypeScore, judgeHype, MAX_BANKED_RESETS, tiboDue } from './hype';
import { LevelGrid } from './level';

describe('hype or shift?', () => {
  it('rewards the right call, and history decides the upgrade either way', () => {
    const lasting = HYPES.reasoning;
    const passing = HYPES.autogpt;
    expect(judgeHype(lasting, 'lasting')).toEqual({ correct: true, perk: 'glide', hangover: 0 });
    // Calling a lasting shift "hype" is wrong, but it still leaves its upgrade.
    expect(judgeHype(lasting, 'passing')).toEqual({ correct: false, perk: 'glide', hangover: 0 });
    expect(judgeHype(passing, 'passing').correct).toBe(true);
    expect(judgeHype(passing, 'lasting')).toMatchObject({ correct: false, perk: undefined });
    expect(judgeHype(passing, 'lasting').hangover).toBeGreaterThan(0);
  });

  it('scores a run’s calls', () => {
    expect(hypeScore({})).toEqual({ right: 0, total: 0 });
    expect(hypeScore({ a: { correct: true }, b: { correct: false }, c: { correct: true } })).toEqual({ right: 2, total: 3 });
  });

  it('keeps perks unique', () => {
    expect(addPerk(['glide'], 'glide')).toEqual(['glide']);
    expect(addPerk(['glide'], 'doubleJump')).toEqual(['glide', 'doubleJump']);
    expect(addPerk([], undefined)).toEqual([]);
  });

  it('gives every lasting hype a perk and every passing hype none', () => {
    for (const h of Object.values(HYPES)) {
      if (h.verdict === 'lasting') expect(h.perk && h.perkText, h.id).toBeTruthy();
      else expect(h.perk, h.id).toBeUndefined();
      expect(h.seconds, h.id).toBeGreaterThan(3);
    }
  });
});

describe('recurring Moments', () => {
  it('brings a Tibo Reset after three deaths, once', () => {
    expect(tiboDue(2, false)).toBe(false);
    expect(tiboDue(3, false)).toBe(true);
    expect(tiboDue(5, true)).toBe(false);
  });

  it('banks up to three resets', () => {
    let banked = 0;
    for (let i = 0; i < 5; i++) banked = bankReset(banked);
    expect(banked).toBe(MAX_BANKED_RESETS);
  });

  it('sets a code red par from the level length', () => {
    expect(codeRedPar(180)).toBe(30);
  });
});

describe('event placement', () => {
  it('matches every $ and ! block to a configured hype or moment, and back', () => {
    for (const l of ALL_LEVELS) {
      const grid = new LevelGrid(l.map);
      const blocks = [...grid.contents.values()];
      expect(blocks.includes('hype'), `${l.id}: $ block vs hype`).toBe(!!l.hype);
      expect(blocks.includes('moment'), `${l.id}: ! block vs moment`).toBe(!!l.moment);
      if (l.hype) expect(HYPES[l.hype], l.id).toBeDefined();
      if (l.moment) expect(MOMENTS[l.moment], l.id).toBeDefined();
      for (const m of l.moments ?? []) expect(MOMENTS[m], `${l.id}: ${m}`).toBeDefined();
      if (l.storm) expect(STORMS[l.storm], l.id).toBeDefined();
      if (grid.spawns.some((s) => s.kind === 'praise')) expect(l.world, `${l.id}: praise coins are a 2025 moment`).toBeGreaterThanOrEqual(5);
    }
  });

  it('uses each hype at most once per path', () => {
    for (const path of ['gpt', 'claude']) {
      const hypes = ALL_LEVELS.filter((l) => l.id.startsWith(path) && l.hype).map((l) => l.hype);
      expect(new Set(hypes).size, path).toBe(hypes.length);
    }
  });
});
