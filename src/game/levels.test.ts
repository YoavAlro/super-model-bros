import { describe, expect, it } from 'vitest';
import { ROSTER } from '../config/characters';
import { ALL_LEVELS, LEVELS } from '../config/levels';
import { STORMS } from '../config/events';
import { MAP_HEIGHT } from '../config/mapTools';
import { PATHS } from '../config/paths';
import { gateGroups, openingGateTiles } from './gates';
import { LevelGrid } from './level';
import type { MoveStats } from './movement';
import { analyzeReach } from './reach';

/** The weakest mover in the roster on every axis: if it can finish a level, everyone can. */
const WEAKEST: MoveStats = {
  walkSpeed: Math.min(...ROSTER.map((c) => c.walkSpeed)),
  runSpeed: Math.min(...ROSTER.map((c) => c.runSpeed)),
  jumpVelocity: Math.min(...ROSTER.map((c) => c.jumpVelocity)),
  gravity: Math.max(...ROSTER.map((c) => c.gravity)),
  fallGravity: Math.max(...ROSTER.map((c) => c.fallGravity)),
};

/**
 * People are not frame-perfect: on a phone they take off a little early or a little slow. So every
 * level must also be finishable, with no soft-locks, when the weakest character's jump velocity is
 * scaled by this margin. A jump that passes only at full strength needs a pixel-perfect take-off.
 * (At 0.94 the deliberate 4-tall climbs, like the lying bar in 5-4, shrink to a 0.04 s window.)
 */
const HUMAN_MARGIN = 0.95;

describe('paths', () => {
  it('reference levels that exist, in world order', () => {
    for (const path of Object.values(PATHS)) {
      let world = 0;
      for (const step of path.steps) {
        const spec = LEVELS[step.level];
        expect(spec, `${path.id}: ${step.level}`).toBeDefined();
        expect(spec.world).toBeGreaterThanOrEqual(world);
        world = spec.world;
      }
    }
  });
});

describe.each(ALL_LEVELS.map((l) => [l.id, l] as const))('level %s', (_id, spec) => {
  const grid = new LevelGrid(spec.map);

  it('has a well-formed map', () => {
    expect(spec.map.length).toBe(MAP_HEIGHT);
    const widths = new Set(spec.map.map((r) => r.length));
    expect(widths.size, 'all rows the same width').toBe(1);
    expect(grid.spawns.filter((s) => s.kind === 'spawn')).toHaveLength(1);
    if (spec.boss) {
      expect(grid.spawnOf('boss'), 'boss level has G').toBeDefined();
      expect(grid.spawnOf('helper'), 'boss level has H').toBeDefined();
      expect(grid.spawnOf('flag')).toBeUndefined();
    } else {
      expect(grid.spawns.filter((s) => s.kind === 'flag')).toHaveLength(1);
    }
  });

  it('matches its storm: one gate group per scripted gate, and a thaw mark for a freeze', () => {
    const storm = spec.storm ? STORMS[spec.storm] : undefined;
    const groups = gateGroups(grid);
    if (storm?.gates) expect(groups.length).toBe(storm.gates.length);
    if (storm?.freeze) expect(grid.marks.some((m) => m.ch === '9'), 'thaw mark 9').toBe(true);
    if (storm?.gates || storm?.freeze) expect(spec.puzzle, 'storm gates and puzzle gates do not mix').toBeUndefined();
  });

  it('offers every token in its recipe', () => {
    const offered = grid.tokenTypes(spec.blockToken);
    for (const id of Object.keys(spec.recipe)) expect(offered.has(id as never), id).toBe(true);
    const sum = Object.values(spec.recipe).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  const expectFinishable = (h: number, jumpScale: number) => {
    const spawn = grid.spawnOf('spawn')!;
    const goal = grid.spawnOf('flag') ?? grid.spawnOf('boss')!;
    // The level's form ability (longer context = floatier jumps) applies to whoever plays it.
    const a = spec.ability ?? {};
    const stats = { ...WEAKEST, jumpVelocity: WEAKEST.jumpVelocity * (a.jump ?? 1) * jumpScale, fallGravity: WEAKEST.fallGravity * (a.float ?? 1) };
    // Storm gates that open once you wait count as open; closed roads stay shut.
    const gates = spec.storm ? STORMS[spec.storm].gates : undefined;
    const open = gates ? openingGateTiles(gateGroups(grid), gates.map((g) => g.wait)) : null;
    const r = analyzeReach(grid, spawn, goal.x, { stats, h, openGate: open ? (x, y) => open.has(`${x},${y}`) : undefined });
    expect(r.goalReachable, `stuck around x=${r.furthestX}`).toBe(true);
    expect(r.deadEnds, 'soft-lock spots').toEqual([]);
  };

  it.each([
    ['small', 0.95],
    ['big', 1.75],
  ])('can be finished, with no soft-locks, by the weakest %s character', (_size, h) => expectFinishable(h, 1));

  it.each([
    ['small', 0.95],
    ['big', 1.75],
  ])(`leaves a human margin: the weakest %s character finishes it on ${Math.round(HUMAN_MARGIN * 100)}% of its jump`, (_size, h) =>
    expectFinishable(h, HUMAN_MARGIN),
  );
});
