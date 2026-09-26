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
      const hypeBlocks = blocks.filter((b) => b === 'hype').length;
      expect(hypeBlocks, `${l.id}: one $ block per hype`).toBe(l.hypes?.length ?? 0);
      expect(blocks.includes('moment'), `${l.id}: ! block vs moment`).toBe(!!l.moment);
      for (const h of l.hypes ?? []) expect(HYPES[h], `${l.id}: ${h}`).toBeDefined();
      if (l.moment) expect(MOMENTS[l.moment], l.id).toBeDefined();
      for (const m of l.moments ?? []) expect(MOMENTS[m], `${l.id}: ${m}`).toBeDefined();
      if (l.storm) expect(STORMS[l.storm], l.id).toBeDefined();
      if (grid.spawns.some((s) => s.kind === 'praise')) expect(l.world, `${l.id}: praise coins are a 2025 moment`).toBeGreaterThanOrEqual(5);
    }
  });

  it('uses each hype at most once per path', () => {
    for (const path of ['gpt', 'claude']) {
      const hypes = ALL_LEVELS.filter((l) => l.id.startsWith(path)).flatMap((l) => l.hypes ?? []);
      expect(new Set(hypes).size, path).toBe(hypes.length);
    }
  });
});

describe('puzzle rules', async () => {
  const { enterInOrder, letterCount, tokenCount } = await import('./puzzleRules');

  it('counts three R’s in letters but two in tokens', () => {
    expect(letterCount('STRAWBERRY', 'R')).toBe(3);
    expect(tokenCount(['STR', 'AW', 'BERRY'], 'R')).toBe(2);
  });

  it('checks the Naming Maze release order, with same-day releases in either order', () => {
    const steps = [
      { label: 'o1', order: 1 },
      { label: 'o2', order: null },
      { label: 'GPT-4.5', order: 2 },
      { label: 'GPT-4.1', order: 3 },
      { label: 'o3', order: 4 },
      { label: 'o4-mini', order: 4 },
    ];
    const done = new Set<string>();
    expect(enterInOrder(steps, done, 'o2')).toBe('sealed');
    expect(enterInOrder(steps, done, 'o1')).toBe('ok');
    expect(enterInOrder(steps, done, 'o1')).toBe('repeat');
    expect(enterInOrder(steps, done, 'GPT-4.1')).toBe('wrong');
    expect(done.size).toBe(0);
    for (const l of ['o1', 'GPT-4.5', 'GPT-4.1', 'o4-mini']) expect(enterInOrder(steps, done, l)).toBe('ok');
    expect(enterInOrder(steps, done, 'o3')).toBe('solved');
  });

  it('ships the maze in the real release order', () => {
    const lvl = ALL_LEVELS.find((l) => l.puzzle?.kind === 'namingMaze')!;
    const pipes = (lvl.puzzle as { pipes: Record<string, { label: string; order: number | null }> }).pipes;
    const byLabel = Object.fromEntries(Object.values(pipes).map((p) => [p.label, p.order]));
    // o1 (Dec 2024) < GPT-4.5 (Feb 27, 2025) < GPT-4.1 (Apr 14, 2025) < o3 = o4-mini (Apr 16, 2025); o2 skipped.
    expect(byLabel).toEqual({ o1: 1, 'GPT-4.5': 2, 'GPT-4.1': 3, o3: 4, 'o4-mini': 4, o2: null });
  });
});
