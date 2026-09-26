import { describe, expect, it } from 'vitest';
import { CHARACTERS, ROSTER } from '../config/characters';
import { LEVELS } from '../config/levels';
import type { LevelSpec } from '../config/levelSpec';
import { PATHS, type PathSpec } from '../config/paths';
import { LevelGrid } from './level';
import { newMover, stepMover, type MoveStats } from './movement';
import { emptyPad, type Pad } from './pad';
import { moveBody } from './physics';
import { checkUnlocks, emptyProgress, endsWorld, formBefore, isUnlocked, nextStep, recordLevel } from './progress';
import { analyzeReach } from './reach';

const STEP = 1 / 120;
const GPT: MoveStats = CHARACTERS.gpt;

const level = (id: string, world: number, toward: string): LevelSpec =>
  ({ id, label: id, world, toward: { name: toward } }) as LevelSpec;
const LV: Record<string, LevelSpec> = {
  a: level('a', 1, 'A1'),
  b: level('b', 2, 'B1'),
  storm: level('storm', 2, 'Storm'),
  c: level('c', 2, 'B2'),
  d: level('d', 3, 'C1'),
};
const PATH: PathSpec = {
  id: 'gpt',
  name: 'Test',
  hero: 'gpt',
  partner: 'claude',
  startForm: 'Blank',
  origin: { name: 'Blank', date: '2017', line: { text: 'Test origin', tip: true } },
  steps: [{ level: 'a' }, { level: 'b' }, { level: 'storm', when: 'shadowBooks' }, { level: 'c' }, { level: 'd' }],
};

describe('path progression', () => {
  it('skips conditional steps unless their flag is set', () => {
    expect(nextStep(PATH, 2, [])).toBe(3);
    expect(nextStep(PATH, 2, ['shadowBooks'])).toBe(2);
    expect(nextStep(PATH, 5, [])).toBe(5);
  });

  it('names you after the last level you actually played', () => {
    expect(formBefore(PATH, 0, [], LV)).toBe('Blank');
    expect(formBefore(PATH, 3, [], LV)).toBe('B1');
    expect(formBefore(PATH, 3, ['shadowBooks'], LV)).toBe('Storm');
  });

  it('knows when a world ends', () => {
    expect(endsWorld(PATH, 0, [], LV)).toBe(true);
    expect(endsWorld(PATH, 1, [], LV)).toBe(false);
    expect(endsWorld(PATH, 3, [], LV)).toBe(true);
    expect(endsWorld(PATH, 4, [], LV)).toBe(true);
  });
});

describe('unlock rules', () => {
  const result = (stars: 1 | 2 | 3) => ({ stars, match: 0.5, alignment: null });

  it('unlocks Gemini for beating World 3 and nothing before', () => {
    let p = emptyProgress();
    p = recordLevel(p, level('x', 2, 'X'), result(1), true);
    expect(checkUnlocks(p, [PATH], LV)).toEqual([]);
    p = recordLevel(p, level('y', 3, 'Y'), result(1), true);
    expect(checkUnlocks(p, [PATH], LV)).toEqual(['gemini']);
  });

  it('unlocks Llama, DeepSeek and Grok for Worlds 4, 5 and 6', () => {
    const p = { ...emptyProgress(), worldsBeaten: [4, 5, 6] };
    expect(checkUnlocks(p, [PATH], LV).sort()).toEqual(['deepseek', 'grok', 'llama']);
  });

  it('unlocks Mistral only for three stars on every World 2 level of a path', () => {
    let p = emptyProgress();
    p = recordLevel(p, LV.b, result(3), false);
    expect(checkUnlocks(p, [PATH], LV)).toEqual([]);
    p = recordLevel(p, LV.c, result(2), true);
    expect(checkUnlocks(p, [PATH], LV)).toEqual([]);
    p = recordLevel(p, LV.c, result(3), true);
    // The conditional storm level is not required.
    expect(checkUnlocks(p, [PATH], LV)).toEqual(['mistral']);
  });

  it('unlocks all five on either real path, in world order, with three stars everywhere', () => {
    for (const path of Object.values(PATHS)) {
      let p = emptyProgress();
      const order: string[] = [];
      for (let i = nextStep(path, 0, []); i < path.steps.length; i = nextStep(path, i + 1, [])) {
        const spec = LEVELS[path.steps[i].level];
        p = recordLevel(p, spec, result(3), endsWorld(path, i, [], LEVELS));
        const got = checkUnlocks(p, [path], LEVELS);
        p = { ...p, unlocked: [...p.unlocked, ...got] };
        order.push(...got.map((id) => `${id}@${spec.world}`));
      }
      expect(p.unlocked.sort(), path.id).toEqual(ROSTER.filter((c) => c.unlockRule).map((c) => c.id).sort());
      expect(order, path.id).toEqual(['mistral@2', 'gemini@3', 'llama@4', 'deepseek@5', 'grok@6']);
    }
  });

  it('keeps the best stars and does not re-unlock', () => {
    let p = recordLevel(emptyProgress(), LV.b, result(3), false);
    p = recordLevel(p, LV.b, result(1), false);
    expect(p.bestStars.b).toBe(3);
    p = { ...p, worldsBeaten: [3], unlocked: ['gemini'] };
    expect(checkUnlocks(p, [PATH], LV)).toEqual([]);
    expect(isUnlocked(p, 'gemini')).toBe(true);
    expect(isUnlocked(p, 'llama')).toBe(false);
    expect(isUnlocked(p, 'gpt')).toBe(true);
  });
});

describe('movement', () => {
  const floor = new LevelGrid(['                              ', '                              ', '##############################']);
  const pad = (over: Partial<Pad>): Pad => ({ ...emptyPad(), ...over });

  function peakAndAir(stats: MoveStats, hold: (f: number) => Partial<Pad>): { peak: number; frames: number } {
    const m = newMover(2, 1, 0.8, 0.95);
    m.body.onGround = true;
    let peak = 1;
    for (let f = 0; f < 600; f++) {
      stepMover(m, pad(hold(f)), stats, floor, STEP);
      peak = Math.max(peak, m.body.y);
      if (f > 5 && m.body.onGround) return { peak: peak - 1, frames: f };
    }
    return { peak: peak - 1, frames: 600 };
  }

  it('jumps about 4 tiles standing, and less for a tap', () => {
    const full = peakAndAir(GPT, () => ({ jump: true }));
    const tap = peakAndAir(GPT, (f) => ({ jump: f < 4 }));
    expect(full.peak).toBeGreaterThan(4);
    expect(full.peak).toBeLessThan(4.5);
    expect(tap.peak).toBeLessThan(2);
  });

  it('floats longer as Claude, and glides longest with a cape', () => {
    const gpt = peakAndAir(GPT, () => ({ jump: true }));
    const claude = peakAndAir(CHARACTERS.claude, () => ({ jump: true }));
    const cape = peakAndAir({ ...GPT, glide: 0.28 }, () => ({ jump: true }));
    expect(claude.frames).toBeGreaterThan(gpt.frames);
    expect(cape.frames).toBeGreaterThan(gpt.frames * 1.5);
  });

  it('air-jumps once with the double-jump perk', () => {
    const one = peakAndAir(GPT, (f) => ({ jump: f < 40 }));
    const two = peakAndAir({ ...GPT, airJumps: 1 }, (f) => ({ jump: f < 40 || (f > 50 && f < 90) }));
    expect(two.peak).toBeGreaterThan(one.peak + 1);
  });

  it('dashes in mid-air when the stats allow it', () => {
    const run = (stats: MoveStats) => {
      const m = newMover(2, 1, 0.8, 0.95);
      m.body.onGround = true;
      for (let f = 0; f < 50; f++) stepMover(m, pad({ right: true, jump: f < 30, run: f === 20 }), stats, floor, STEP);
      return m.body.x;
    };
    expect(run({ ...GPT, airDash: true })).toBeGreaterThan(run(GPT) + 1.5);
  });

  it('carries you along a conveyor belt', () => {
    const belt = new LevelGrid(['          ', '>>>>>>>>>>']);
    const m = newMover(2, 1, 0.8, 0.95);
    for (let f = 0; f < 120; f++) stepMover(m, emptyPad(), GPT, belt, STEP);
    expect(m.body.x).toBeGreaterThan(4);
  });

  it('lands on one-way platforms from above and passes through from below', () => {
    const grid = new LevelGrid(['          ', '   ===    ', '          ', '          ', '##########']);
    const below = { x: 3.1, y: 1, w: 0.8, h: 0.95, vx: 0, vy: 20, onGround: false };
    moveBody(below, 0.1, grid);
    expect(below.y).toBeCloseTo(3);
    const above = { x: 3.1, y: 4.2, w: 0.8, h: 0.95, vx: 0, vy: -10, onGround: false };
    moveBody(above, 0.05, grid);
    expect(above.y).toBe(4);
    expect(above.onGround).toBe(true);
  });
});

describe('reachability checker', () => {
  const check = (map: string[]) => {
    const grid = new LevelGrid(map);
    return analyzeReach(grid, grid.spawnOf('spawn')!, grid.spawnOf('flag')!.x, { stats: GPT, h: 0.95 });
  };

  it('passes a level with a jumpable wall and gap', () => {
    const r = check([
      '                    ',
      '                    ',
      '         X          ',
      '         X          ',
      '         X          ',
      ' S       X        F ',
      '##########   #######',
      '##########   #######',
    ]);
    expect(r.goalReachable).toBe(true);
    expect(r.deadEnds).toEqual([]);
  });

  it('fails a wall that is too tall', () => {
    const r = check([
      '         X          ',
      '         X          ',
      '         X          ',
      '         X          ',
      '         X          ',
      '         X          ',
      ' S       X        F ',
      '####################',
    ]);
    expect(r.goalReachable).toBe(false);
  });

  it('finds a soft-lock: a walled ditch you can fall into but never leave', () => {
    const r = check([
      '                      ',
      '                      ',
      '                      ',
      ' S                  F ',
      '#####      ###########',
      '#####XXXXXX###########',
      '######################',
      '######################',
      '######################',
      '######################',
    ]);
    expect(r.goalReachable).toBe(true);
    expect(r.deadEnds.length).toBe(0);
    const deep = check([
      '                      ',
      '                      ',
      ' S                  F ',
      '#####      ###########',
      '#####      ###########',
      '#####      ###########',
      '#####      ###########',
      '#####      ###########',
      '#####XXXXXX###########',
      '######################',
    ]);
    expect(deep.deadEnds.length).toBeGreaterThan(0);
  });

  it('stands a body that landed hanging off a ledge on the ledge, not in mid-air', () => {
    // Spot (10, 2) is keyed by the pit column, but a body there still has its feet on the ledge
    // and can walk back for a run-up. Started in mid-air it could only hop back into the block
    // above the ledge and drop into the pit, so the spot used to read as a soft-lock.
    const grid = new LevelGrid([
      '                            ',
      '                            ',
      '         X                  ',
      '                            ',
      '                            ',
      '                         F  ',
      '##########        ##########',
      '##########        ##########',
    ]);
    const r = analyzeReach(grid, { x: 10, y: 2 }, grid.spawnOf('flag')!.x, { stats: { ...GPT, jumpVelocity: 21 }, h: 1.75 });
    expect(r.goalReachable).toBe(true);
    expect(r.deadEnds).toEqual([]);
  });
});

describe('storms', () => {
  it('counts storm days by how far the camera has scrolled', async () => {
    const { stormDay } = await import('./storm');
    expect(stormDay(0, 100, 5)).toBe(0);
    expect(stormDay(19.9, 100, 5)).toBe(0);
    expect(stormDay(20, 100, 5)).toBe(1);
    expect(stormDay(99, 100, 5)).toBe(4);
    expect(stormDay(250, 100, 5)).toBe(4);
    expect(stormDay(-5, 100, 5)).toBe(0);
    expect(stormDay(50, 0, 5)).toBe(0);
  });

  it('gives the board crisis five days and a heart goal it can meet', async () => {
    const { STORMS } = await import('../config/events');
    const { LEVELS } = await import('../config/levels');
    const storm = STORMS.boardCrisis;
    expect(storm.days).toHaveLength(5);
    const grid = new LevelGrid(LEVELS['gpt-3-3'].map);
    const hearts = grid.spawns.filter((s) => s.kind === 'heart').length;
    expect(hearts).toBeGreaterThanOrEqual(storm.hearts!);
  });
});
